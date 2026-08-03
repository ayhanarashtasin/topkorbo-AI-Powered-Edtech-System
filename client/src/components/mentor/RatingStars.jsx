import { HiStar } from 'react-icons/hi';

const STAR_VALUES = [1, 2, 3, 4, 5];

function normalizedRating(value) {
  return Math.min(5, Math.max(0, Math.round(Number(value) || 0)));
}

export function RatingDisplay({ value = 0 }) {
  const numericRating = Math.min(5, Math.max(0, Number(value) || 0));
  const rating = normalizedRating(numericRating);
  const accessibleRating = Number(numericRating.toFixed(1));

  return (
    <span className="mentor-rating-display" role="img" aria-label={`${accessibleRating} out of 5 stars`}>
      {STAR_VALUES.map((star) => (
        <HiStar
          key={star}
          className={star <= rating ? 'mentor-rating-display__star mentor-rating-display__star--filled' : 'mentor-rating-display__star'}
          size={16}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export function RatingInput({ value, onChange, name = 'mentor-review-rating' }) {
  const rating = normalizedRating(value);

  return (
    <fieldset className="mentor-rating-input">
      <legend>Your rating</legend>
      <div className="mentor-rating-input__options">
        {STAR_VALUES.map((star) => (
          <label key={star} className="mentor-rating-input__option">
            <input
              type="radio"
              name={name}
              value={star}
              checked={rating === star}
              onChange={() => onChange(star)}
              aria-label={`${star} out of 5 stars`}
            />
            <HiStar
              className={star <= rating ? 'mentor-rating-input__star mentor-rating-input__star--filled' : 'mentor-rating-input__star'}
              size={26}
              aria-hidden="true"
            />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
