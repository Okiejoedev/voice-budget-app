import type { Pot } from './types';

// Default pots with the Naija words people actually use for each one.
// Users can add their own words per pot in the Plan screen.
export const DEFAULT_POTS: Pot[] = [
  {
    id: 'data', name: 'Data & Airtime', emoji: '📶', planned: 20000, carry: 0,
    keywords: ['data', 'airtime', 'recharge', 'recharge card', 'credit', 'subscribe', 'subscription', 'mtn', 'glo', 'airtel', '9mobile', 'wifi', 'internet', 'bundle'],
  },
  {
    id: 'transport', name: 'Transport', emoji: '🚌', planned: 60000, carry: 0,
    keywords: ['transport', 'keke', 'okada', 'danfo', 'brt', 'bolt', 'uber', 'indrive', 'taxi', 'cab', 'bus', 'fuel', 'petrol', 'fare', 'transport fare', 'ride', 'drop', 'car wash', 'mechanic', 'train', 'ferry', 'boat', 'tricycle', 'bike'],
  },
  {
    id: 'feeding', name: 'Feeding', emoji: '🍲', planned: 60000, carry: 0,
    keywords: ['feeding', 'food', 'chop', 'mama put', 'buka', 'bukka', 'restaurant', 'lunch', 'breakfast', 'dinner', 'rice', 'beans', 'bread', 'eba', 'amala', 'swallow', 'suya', 'shawarma', 'chicken republic', 'kfc', 'foodstuff', 'food stuff', 'market', 'groceries', 'grocery', 'provisions', 'snacks', 'water', 'pure water', 'garri', 'yam', 'indomie', 'noodles', 'egg', 'eggs', 'meat', 'fish', 'tomatoes', 'pepper', 'oil', 'pizza', 'drink', 'malt', 'coke'],
  },
  {
    id: 'rent', name: 'Rent & House', emoji: '🏠', planned: 0, carry: 0,
    keywords: ['rent', 'house rent', 'landlord', 'agent fee', 'caution fee', 'service charge', 'estate due', 'estate dues', 'waste', 'pmp', 'cleaning'],
  },
  {
    id: 'power', name: 'Light & Power', emoji: '💡', planned: 0, carry: 0,
    keywords: ['light', 'light bill', 'nepa', 'phcn', 'prepaid', 'meter', 'electricity', 'units', 'token', 'diesel', 'gen', 'generator', 'gen fuel', 'solar', 'inverter', 'gas', 'cooking gas'],
  },
  {
    id: 'family', name: 'Family & Support', emoji: '👨‍👩‍👧', planned: 0, carry: 0,
    keywords: ['family', 'mama', 'mum', 'mom', 'mother', 'papa', 'dad', 'father', 'brother', 'sister', 'sibling', 'black tax', 'school fees', 'pikin', 'children', 'kids', 'support', 'send home', 'village', 'dash', 'settle', 'gift'],
  },
  {
    id: 'giving', name: 'Giving', emoji: '🙏', planned: 0, carry: 0,
    keywords: ['offering', 'tithe', 'seed', 'church', 'mosque', 'zakat', 'charity', 'donation', 'thanksgiving', 'first fruit', 'pledge'],
  },
  {
    id: 'enjoyment', name: 'Enjoyment', emoji: '🎉', planned: 0, carry: 0,
    keywords: ['enjoyment', 'outing', 'hangout', 'owambe', 'party', 'aso ebi', 'aso-ebi', 'shayo', 'beer', 'club', 'cinema', 'movie', 'netflix', 'showmax', 'spotify', 'dstv', 'gotv', 'date', 'vacation', 'game', 'betting', 'bet'],
  },
  {
    id: 'self', name: 'Self-care', emoji: '💈', planned: 0, carry: 0,
    keywords: ['barber', 'haircut', 'hair', 'salon', 'clothes', 'shoe', 'shoes', 'cloth', 'tailor', 'laundry', 'drycleaner', 'dry clean', 'gym', 'hospital', 'drugs', 'medicine', 'pharmacy', 'chemist', 'toiletries', 'cream', 'perfume'],
  },
  {
    id: 'other', name: 'Other', emoji: '🧾', planned: 0, carry: 0,
    keywords: [],
  },
];

// Words that mean "this is money coming in".
export const INCOME_WORDS = [
  'salary', 'salary don land', 'don land', 'pay day', 'payday', 'dem pay me', 'they paid me', 'i got paid', 'got paid',
  'i collect', 'i collected', 'i receive', 'i received', 'received', 'i earn', 'i earned', 'earned', 'i make', 'i made', 'made',
  'credited', 'credit alert', 'alert don enter', 'alert enter', 'money don enter', 'money enter', 'enter my account', 'entered my account',
  'commission', 'bonus', 'allowance', 'stipend', 'profit', 'gig', 'client pay', 'client paid', 'income', 'refund', 'dem send me', 'sent me',
  'i get alert', 'i gat alert', 'cash out', 'inflow', 'freelance', 'side hustle', 'side money',
];

// Words that mean "money going out".
export const EXPENSE_WORDS = [
  'spend', 'spent', 'i don spend', 'buy', 'bought', 'i buy', 'pay', 'paid', 'i pay', 'chop', 'chopped', 'ate', 'eat', 'enter', 'entered',
  'take', 'took', 'comot', 'gave', 'give', 'dash', 'send', 'sent', 'settle', 'settled', 'transfer', 'transferred', 'use', 'used', 'cost',
  'subscribe', 'recharge', 'renew', 'renewed', 'fuel', 'drop',
];

// Words that mean "set up the budget plan".
export const PLAN_WORDS = [
  'budget', 'plan', 'allocate', 'allocation', 'set aside', 'share am', 'split', 'divide', 'abeg put', 'make we put', 'let me put',
  'i wan put', 'i want to put', 'i go put', 'mark', 'reserve', 'keep',
];

export const SAVINGS_WORDS = ['savings', 'saving', 'save', 'vault', 'piggy', 'emergency fund', 'emergency', 'reserve fund'];

export const QUESTION_WORDS = [
  'wetin remain', 'what remains', 'what is left', "what's left", 'how much remain', 'how much is left', 'how much left',
  'how much i get', 'how much do i have', 'how much i don spend', 'how much have i spent', 'how much i spend', 'how much did i spend',
  'i fit spend', 'can i spend', 'balance', 'how far', 'how my money', 'how is my budget', 'remain', 'summary', 'report',
];

export const UNDO_WORDS = [
  'cancel', 'undo', 'delete last', 'remove last', 'no be dat one', 'no be that one', 'wrong one', 'scrap am', 'remove am', 'delete am', 'cancel am', 'clear last',
];

export const EDIT_LAST_WORDS = ['change am to', 'make am', 'change it to', 'make it', 'correct am to', 'correct it to', 'e suppose be', 'it should be', 'it was'];
