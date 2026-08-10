import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { HiCheckCircle, HiXCircle, HiHome, HiRefresh, HiArrowLeft } from 'react-icons/hi';
import { usePlan } from '../hooks/usePlan';
import './PaymentStatus.css';

export default function PaymentStatus() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = usePlan();

  const status = searchParams.get('status') || 'success';
  const role = searchParams.get('role') || 'tutor';
  const isSuccess = ['success', 'valid', 'validated', '1'].includes(status.toLowerCase());

  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (isSuccess) {
      refresh(); // Sync effective plan immediately
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/dashboard');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isSuccess, refresh, navigate]);

  return (
    <div className="payment-status">
      <div className="payment-status__card">
        {isSuccess ? (
          <>
            <div className="payment-status__icon-wrapper is-success">
              <HiCheckCircle className="payment-status__icon" />
            </div>
            <h1 className="payment-status__title">Payment Successful! 🎉</h1>
            <p className="payment-status__message">
              {role === 'tutor' || role === 'teacher'
                ? 'Your Mentor Pro subscription is now active! Live classrooms, question bank, reading tools, and AI capabilities are unlocked.'
                : 'Your TopKorbo Pro subscription is now active! Enjoy unlimited exams and study features.'}
            </p>
            <div className="payment-status__badge">
              <span>Status: VALIDATED</span>
              <span>Redirecting to Dashboard in {countdown}s...</span>
            </div>
            <div className="payment-status__actions">
              <button
                type="button"
                className="payment-status__btn is-primary"
                onClick={() => navigate('/dashboard')}
              >
                <HiHome /> Go to Dashboard Now
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="payment-status__icon-wrapper is-failed">
              <HiXCircle className="payment-status__icon" />
            </div>
            <h1 className="payment-status__title">Payment Failed or Cancelled</h1>
            <p className="payment-status__message">
              We couldn't process your SSLCommerz payment. Don't worry — no charges were made to your account.
            </p>
            <div className="payment-status__actions">
              <button
                type="button"
                className="payment-status__btn is-primary"
                onClick={() => navigate(role === 'tutor' ? '/mentor-pricing' : '/pricing')}
              >
                <HiRefresh /> Try Payment Again
              </button>
              <button
                type="button"
                className="payment-status__btn is-secondary"
                onClick={() => navigate('/dashboard')}
              >
                <HiArrowLeft /> Back to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
