import paypal from 'paypal-rest-sdk';
import dotenv from 'dotenv';

dotenv.config();

paypal.configure({
  mode: process.env.PAYPAL_MODE, // 'sandbox' or 'live'
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET
});

export const createPayment = async (appointmentData) => {
  const create_payment_json = {
    intent: 'sale',
    payer: {
      payment_method: 'paypal'
    },
    redirect_urls: {
      return_url: `${process.env.FRONTEND_URL}/payment/success`,
      cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`
    },
    transactions: [{
      item_list: {
        items: [{
          name: appointmentData.service_name,
          sku: `appointment_${appointmentData.appointment_id}`,
          price: appointmentData.amount.toString(),
          currency: 'PHP',
          quantity: 1
        }]
      },
      amount: {
        currency: 'PHP',
        total: appointmentData.amount.toString()
      },
      description: `Payment for dental appointment - ${appointmentData.service_name}`
    }]
  };

  return new Promise((resolve, reject) => {
    paypal.payment.create(create_payment_json, (error, payment) => {
      if (error) {
        reject(error);
      } else {
        resolve(payment);
      }
    });
  });
};

export const executePayment = async (paymentId, payerId) => {
  const execute_payment_json = {
    payer_id: payerId
  };

  return new Promise((resolve, reject) => {
    paypal.payment.execute(paymentId, execute_payment_json, (error, payment) => {
      if (error) {
        reject(error);
      } else {
        resolve(payment);
      }
    });
  });
};

export const refundPayment = async (saleId, refundAmount) => {
  const refund_json = {
    amount: {
      total: refundAmount.toString(),
      currency: 'PHP'
    }
  };

  return new Promise((resolve, reject) => {
    paypal.sale.refund(saleId, refund_json, (error, refund) => {
      if (error) {
        reject(error);
      } else {
        resolve(refund);
      }
    });
  });
};

export const getPaymentDetails = async (paymentId) => {
  return new Promise((resolve, reject) => {
    paypal.payment.get(paymentId, (error, payment) => {
      if (error) {
        reject(error);
      } else {
        resolve(payment);
      }
    });
  });
};
