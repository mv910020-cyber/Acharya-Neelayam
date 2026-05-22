import type { SiteLanguage } from './siteCopy';

type LocalizedText = Record<SiteLanguage, string>;

type ContactProfile = {
  businessName: string;
  contactPerson: string;
  role: LocalizedText;
  phone: string;
  email: string;
  addressLineOne: LocalizedText;
  addressLineTwo: LocalizedText;
  hours: LocalizedText;
  responseTime: LocalizedText;
  serviceNote: LocalizedText;
};

export const contactProfile: ContactProfile = {
  // Replace these placeholders with your own public-facing business details.
  businessName: 'Aachara Nilayam',
  contactPerson: 'Malyala Madhu',
  role: {
    en: 'Contact person',
    te: 'సంప్రదించవలసిన వ్యక్తి',
  },
  phone: '+91 7731940055',
  email: 'mv9100201@gmail.com',
  addressLineOne: {
    en: '3-85, Karminagara Road No. 5',
    te: '3-85, కర్మినగర రోడ్ నం. 5',
  },
  addressLineTwo: {
    en: '505307',
    te: '505307',
  },
  hours: {
    en: 'Mon to Sat, 8:00 AM to 8:00 PM',
    te: 'సోమ నుండి శని, ఉదయం 8:00 నుండి రాత్రి 8:00 వరకు',
  },
  responseTime: {
    en: 'Usually within a few hours',
    te: 'సాధారణంగా కొన్ని గంటలలో స్పందిస్తాము',
  },
  serviceNote: {
    en: 'For quicker follow-up, share the product name, quantity, and required date.',
    te: 'త్వరగా స్పందించాలంటే product name, quantity, date చెప్తే బాగుంటుంది.',
  },
};

export function getContactProfileInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return 'AN';
  }

  return words.map((word) => word[0]?.toUpperCase() ?? '').join('');
}

export function getPhoneDigits(phone: string) {
  return phone.replace(/\D/g, '');
}
