import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import axios from 'axios';
import { getProductName } from '../content/siteCopy';
import { useLanguage } from '../context/LanguageContext';
import { useStore } from '../context/StoreContext';
import { useProductActions } from '../hooks/useProductActions';

type AttachmentKind = 'image' | 'pdf';
type AssistantAction = 'add_to_cart' | 'buy_now';

type AssistantAttachment = {
  data: string;
  kind: AttachmentKind;
  mimeType: string;
  name: string;
  size: number;
};

type SelectedAttachment = AssistantAttachment & {
  previewUrl: string | null;
};

type AssistantMessage = {
  actions?: AssistantAction[];
  attachment?: AssistantAttachment;
  id: string;
  productId?: string;
  role: 'assistant' | 'user';
  text: string;
};

type AssistantApiResponse = {
  actions?: AssistantAction[];
  productId?: string | null;
  text: string;
};

const MAX_CONTEXT_MESSAGES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

function createMessageId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Unable to read the selected file.'));
        return;
      }

      const [, base64Payload = ''] = reader.result.split(',');
      resolve(base64Payload);
    };

    reader.onerror = () => {
      reject(new Error('Unable to read the selected file.'));
    };

    reader.readAsDataURL(file);
  });
}

function getRequestErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function toApiAttachment(attachment?: AssistantAttachment) {
  if (!attachment) {
    return undefined;
  }

  return {
    data: attachment.data,
    mimeType: attachment.mimeType,
    name: attachment.name,
  };
}

type AssistantChatCardProps = {
  className?: string;
  onClose?: () => void;
  selectedProductName?: string;
};

export default function AssistantChatCard({
  className,
  onClose,
  selectedProductName,
}: AssistantChatCardProps) {
  const { copy, language } = useLanguage();
  const { products } = useStore();
  const { handleAddToCart, handleBuyNow } = useProductActions();
  const assistantCopy = copy.assistant;
  const userLabel = language === 'te' ? '\u0c2e\u0c40\u0c30\u0c41' : 'You';
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const historyRef = useRef<HTMLDivElement | null>(null);
  const welcomeMessage = useMemo<AssistantMessage>(
    () => ({
      id: createMessageId(),
      role: 'assistant',
      text: assistantCopy.welcome,
    }),
    [assistantCopy.welcome]
  );

  const [messages, setMessages] = useState<AssistantMessage[]>([welcomeMessage]);
  const [draft, setDraft] = useState('');
  const [selectedFile, setSelectedFile] = useState<SelectedAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    setMessages((current) => {
      if (current.length === 1 && current[0]?.role === 'assistant') {
        return [{ ...welcomeMessage, id: current[0].id }];
      }

      return current;
    });
  }, [welcomeMessage]);

  useEffect(() => {
    const historyElement = historyRef.current;
    if (!historyElement) {
      return;
    }

    historyElement.scrollTo({
      top: historyElement.scrollHeight,
      behavior: 'smooth',
    });
  }, [isSending, messages]);

  useEffect(() => {
    return () => {
      if (selectedFile?.previewUrl) {
        URL.revokeObjectURL(selectedFile.previewUrl);
      }
    };
  }, [selectedFile]);

  const clearSelectedFile = () => {
    setSelectedFile((current) => {
      if (current?.previewUrl) {
        URL.revokeObjectURL(current.previewUrl);
      }

      return null;
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const isSupportedFile =
      file.type === 'application/pdf' || file.type.startsWith('image/');

    if (!isSupportedFile) {
      setError(assistantCopy.uploadError);
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setError(assistantCopy.uploadTooLarge);
      return;
    }

    try {
      const base64Data = await fileToBase64(file);
      const nextPreviewUrl = file.type.startsWith('image/')
        ? URL.createObjectURL(file)
        : null;

      setSelectedFile((current) => {
        if (current?.previewUrl) {
          URL.revokeObjectURL(current.previewUrl);
        }

        return {
          data: base64Data,
          kind: file.type === 'application/pdf' ? 'pdf' : 'image',
          mimeType: file.type,
          name: file.name,
          previewUrl: nextPreviewUrl,
          size: file.size,
        };
      });
      setError(null);
    } catch (fileError) {
      setError(getRequestErrorMessage(fileError, assistantCopy.generalError));
    }
  };

  const handleSend = async () => {
    const trimmedDraft = draft.trim();
    const promptText =
      trimmedDraft || (selectedFile ? assistantCopy.fileOnlyPrompt : '');

    if (!promptText) {
      return;
    }

    const outgoingAttachment = selectedFile
      ? {
          data: selectedFile.data,
          kind: selectedFile.kind,
          mimeType: selectedFile.mimeType,
          name: selectedFile.name,
          size: selectedFile.size,
        }
      : undefined;

    const optimisticUserMessage: AssistantMessage = {
      attachment: outgoingAttachment,
      id: createMessageId(),
      role: 'user',
      text: promptText,
    };

    const historyPayload = messages
      .slice(-MAX_CONTEXT_MESSAGES)
      .map((message) => ({
        attachment: toApiAttachment(message.attachment),
        role: message.role,
        text: message.text,
      }));

    setMessages((current) => [...current, optimisticUserMessage]);
    setDraft('');
    clearSelectedFile();
    setError(null);
    setIsSending(true);

    try {
      const response = await axios.post<AssistantApiResponse>(`${apiUrl}/chat`, {
        attachment: toApiAttachment(outgoingAttachment),
        history: historyPayload,
        language,
        message: promptText,
      });

      setMessages((current) => [
        ...current,
        {
          actions: response.data.actions,
          id: createMessageId(),
          productId: response.data.productId ?? undefined,
          role: 'assistant',
          text: response.data.text,
        },
      ]);
    } catch (requestError) {
      setError(getRequestErrorMessage(requestError, assistantCopy.generalError));
    } finally {
      setIsSending(false);
    }
  };

  const handleComposerSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleSend();
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const canSend = draft.trim().length > 0 || selectedFile !== null;

  return (
    <section
      className={className ? `assistant-chat-card ${className}` : 'assistant-chat-card'}
    >
      <div className="assistant-chat-header">
        <div className="assistant-chat-heading">
          <h2>{assistantCopy.title}</h2>
          <p>{assistantCopy.lead}</p>
        </div>

        <div className="assistant-chat-header-actions">
          <span className="assistant-chat-badge">{assistantCopy.supportedFiles}</span>
          {onClose ? (
            <button
              type="button"
              className="assistant-widget-close"
              onClick={onClose}
              aria-label="Close assistant"
            >
              X
            </button>
          ) : null}
        </div>
      </div>

      {selectedProductName ? (
        <div className="assistant-chat-context-pill">
          <span>{assistantCopy.selectedProduct}</span>
          <strong>{selectedProductName}</strong>
        </div>
      ) : null}

      <div className="assistant-chat-history" ref={historyRef}>
        {messages.map((message) => (
          (() => {
            const actionProduct = message.productId
              ? products.find((product) => product.id === message.productId)
              : undefined;
            const localizedProductName = actionProduct
              ? getProductName(actionProduct.id, actionProduct.name, language)
              : null;
            const canRenderActions =
              message.role === 'assistant' &&
              !!actionProduct &&
              !!localizedProductName &&
              actionProduct.quantity > 0 &&
              !!message.actions?.length;

            return (
              <article
                key={message.id}
                className={`assistant-message assistant-message-${message.role}`}
              >
                <div className="assistant-message-meta">
                  <span>{message.role === 'assistant' ? assistantCopy.title : userLabel}</span>
                </div>

                {message.attachment ? (
                  <div className="assistant-file-chip">
                    <span className="assistant-file-chip-icon" aria-hidden="true">
                      {message.attachment.kind === 'pdf' ? 'PDF' : 'IMG'}
                    </span>
                    <span>{message.attachment.name}</span>
                  </div>
                ) : null}

                <p>{message.text}</p>

                {canRenderActions && actionProduct ? (
                  <div className="assistant-message-actions">
                    {(message.actions ?? []).includes('add_to_cart') ? (
                      <button
                        type="button"
                        className="secondary-button assistant-message-action-button"
                        onClick={() => handleAddToCart(actionProduct.id)}
                      >
                        {copy.common.addToCart}
                      </button>
                    ) : null}
                    {(message.actions ?? []).includes('buy_now') ? (
                      <button
                        type="button"
                        className="primary-button assistant-message-action-button"
                        onClick={() => handleBuyNow(actionProduct.id)}
                      >
                        {copy.common.buyNow}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })()
        ))}

        {isSending ? (
          <article className="assistant-message assistant-message-assistant assistant-message-typing">
            <div className="assistant-message-meta">
              <span>{assistantCopy.title}</span>
            </div>
            <p>{assistantCopy.typing}</p>
          </article>
        ) : null}
      </div>

      <form className="assistant-chat-composer" onSubmit={handleComposerSubmit}>
        {selectedFile ? (
          <div className="assistant-attachment-preview">
            <div className="assistant-attachment-preview-media">
              {selectedFile.previewUrl ? (
                <img src={selectedFile.previewUrl} alt={selectedFile.name} />
              ) : (
                <span>{selectedFile.kind === 'pdf' ? 'PDF' : 'IMG'}</span>
              )}
            </div>

            <div className="assistant-attachment-preview-copy">
              <span>{assistantCopy.attachedLabel}</span>
              <strong>{selectedFile.name}</strong>
            </div>

            <button
              type="button"
              className="assistant-remove-file"
              onClick={clearSelectedFile}
              aria-label={assistantCopy.removeFile}
            >
              X
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="status-panel status-panel-error">{error}</div>
        ) : null}

        <div className="assistant-chat-input-row">
          <label className="assistant-chat-input-shell">
            <span className="assistant-chat-input-label">{assistantCopy.title}</span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder={assistantCopy.placeholder}
              rows={4}
              disabled={isSending}
            />
          </label>

          <div className="assistant-chat-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              className="assistant-chat-file-input"
              onChange={handleFileChange}
              disabled={isSending}
            />

            <button
              type="button"
              className="secondary-button assistant-upload-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
            >
              <span className="assistant-upload-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M8.5 12.8L14.7 6.6a3 3 0 1 1 4.2 4.2l-8.1 8.1a5 5 0 1 1-7.1-7.1L13 2.6" />
                </svg>
              </span>
              <span>{assistantCopy.upload}</span>
            </button>

            <button
              type="submit"
              className="primary-button assistant-send-button"
              disabled={!canSend || isSending}
            >
              {isSending ? assistantCopy.sending : assistantCopy.send}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
