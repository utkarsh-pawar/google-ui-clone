// Finance topics for the auto-generator. Rotates daily by default.
export const FINANCE_TOPICS = [
  { topic: 'Why your salary will never make you rich', angle: 'mindset' },
  { topic: 'The ₹500/month investment that becomes ₹1 crore', angle: 'investing' },
  { topic: 'Signs you are financially behind for your age', angle: 'reality-check' },
  { topic: 'How to escape the paycheck-to-paycheck cycle', angle: 'practical' },
  { topic: 'The credit card trap banks don\'t want you to know', angle: 'debt' },
  { topic: 'Why people who earn ₹20 lakh are still broke', angle: 'mindset' },
  { topic: 'How to make your first ₹1 lakh outside your job', angle: 'side-income' },
  { topic: 'The compound interest rule that changes everything', angle: 'investing' },
  { topic: 'Why your parents\' financial advice is wrong in 2024', angle: 'mindset' },
  { topic: 'One freelance skill that pays ₹50,000 a month', angle: 'side-income' },
  { topic: 'How to negotiate a 30% salary hike at your next job', angle: 'career' },
  { topic: 'The difference between assets and liabilities nobody teaches', angle: 'education' },
  { topic: 'How to build an emergency fund in 6 months', angle: 'practical' },
  { topic: 'Why buying a house in your 20s is a mistake', angle: 'controversial' },
  { topic: 'The silent wealth killer: lifestyle inflation', angle: 'mindset' },
  { topic: 'How to invest when you have no money', angle: 'beginner' },
  { topic: 'What ₹5,000/month in SIP does over 20 years', angle: 'investing' },
  { topic: 'How one high-income skill ends financial stress', angle: 'side-income' },
  { topic: 'The money habits of people who retire at 40', angle: 'mindset' },
  { topic: 'Why your EMI is making someone else rich', angle: 'debt' },
  { topic: 'How to build passive income with zero capital', angle: 'passive-income' },
  { topic: 'The 50-30-20 rule and why most people do it wrong', angle: 'budgeting' },
  { topic: 'Why ₹1 crore is no longer enough to retire', angle: 'reality-check' },
  { topic: 'How to save tax legally and keep more money', angle: 'tax' },
  { topic: 'The index fund strategy that beats most investors', angle: 'investing' },
  { topic: 'How to build wealth on a ₹30,000 salary', angle: 'practical' },
  { topic: 'Why working overtime is keeping you poor', angle: 'mindset' },
  { topic: 'The FIRE movement: retire in 10 years', angle: 'mindset' },
  { topic: 'How to turn one skill into a digital product', angle: 'side-income' },
  { topic: 'The truth about crypto no one tells beginners', angle: 'investing' },
  { topic: 'Why your savings account is losing you money', angle: 'education' },
  { topic: 'How to build a ₹10,000/month side income in 90 days', angle: 'side-income' },
  { topic: 'Signs you need to change your money mindset', angle: 'mindset' },
  { topic: 'The investment mistake 90% of Indians make', angle: 'investing' },
  { topic: 'How to start a digital business with ₹0', angle: 'entrepreneurship' },
  { topic: 'Why you keep running out of money before month end', angle: 'budgeting' },
  { topic: 'The power of paying yourself first', angle: 'practical' },
  { topic: 'How to build wealth in your 20s vs 30s vs 40s', angle: 'investing' },
  { topic: 'The rich vs middle class difference in one habit', angle: 'mindset' },
  { topic: 'Why a 9-5 job is the riskiest financial decision', angle: 'controversial' },
  { topic: 'How YouTube AdSense creates passive income', angle: 'passive-income' },
  { topic: 'The real cost of your ₹40,000 phone', angle: 'reality-check' },
  { topic: 'How to create multiple income streams from scratch', angle: 'side-income' },
  { topic: 'Why most people will never be wealthy (hard truth)', angle: 'mindset' },
  { topic: 'The ₹100/day habit that builds crores over time', angle: 'investing' },
  { topic: 'How to quit your job in 2 years with a plan', angle: 'practical' },
  { topic: 'The insurance scam that steals your wealth', angle: 'controversial' },
  { topic: 'How to make money while you sleep in 2024', angle: 'passive-income' },
  { topic: 'Why smart people stay broke (psychology of money)', angle: 'mindset' },
  { topic: 'The exact steps to go from ₹0 savings to ₹10 lakh', angle: 'practical' },
];

// Pick today's topic deterministically (same topic all day, cycles through list)
export function getTodaysTopic() {
  const dayIndex = Math.floor(Date.now() / 86400000) % FINANCE_TOPICS.length;
  return FINANCE_TOPICS[dayIndex];
}

// Get N topics not recently used (simple rotation)
export function getTopicQueue(count = 7) {
  const startIdx = Math.floor(Date.now() / 86400000) % FINANCE_TOPICS.length;
  return Array.from({ length: count }, (_, i) =>
    FINANCE_TOPICS[(startIdx + i) % FINANCE_TOPICS.length]
  );
}
