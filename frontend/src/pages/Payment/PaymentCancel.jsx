import { useNavigate } from 'react-router-dom';
import { XCircle, ArrowLeft, CreditCard } from 'lucide-react';

const PaymentCancel = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        <div className="card p-8 text-center">
          {/* Cancel Icon */}
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-red-600" />
          </div>

          {/* Cancel Message */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Payment Cancelled
          </h1>
          <p className="text-gray-600 mb-8">
            Your payment was cancelled. No charges have been made to your account.
          </p>

          {/* Information */}
          <div className="bg-yellow-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-yellow-900 mb-2">What happened?</h3>
            <div className="text-sm text-yellow-700 space-y-1">
              <p>• You cancelled the payment on PayPal</p>
              <p>• Your appointment is still approved</p>
              <p>• You can try paying again anytime</p>
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">Next Steps</h3>
            <div className="text-sm text-blue-700 space-y-1">
              <div className="flex items-center">
                <CreditCard className="w-4 h-4 mr-2" />
                <span>Complete payment to confirm your appointment</span>
              </div>
              <div className="flex items-center">
                <ArrowLeft className="w-4 h-4 mr-2" />
                <span>Return to dashboard to try again</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/patient/dashboard')}
              className="w-full btn btn-primary"
            >
              Back to Dashboard
            </button>
            <button
              onClick={() => navigate('/patient/appointments')}
              className="w-full btn btn-secondary"
            >
              View My Appointments
            </button>
          </div>

          {/* Support */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Having trouble with payment? Contact our support team for assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancel;
