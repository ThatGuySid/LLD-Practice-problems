const tones = {
  Strong: 'strong',
  Adequate: 'adequate',
  'Needs work': 'needs',
  'Not addressed': 'missing',
};

export default function RatingPill({ rating }) {
  return <span className={`rating-pill ${tones[rating] || 'missing'}`}>{rating}</span>;
}
