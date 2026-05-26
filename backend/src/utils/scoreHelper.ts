import Tenant from '../models/Tenant.js';
import TenantReview from '../models/TenantReview.js';
import Payment from '../models/Payment.js';

export interface ScoreDetails {
  score: number;
  averageRating: number;
  riskLevel: 'low' | 'medium' | 'high';
  feedbacks: string[];
}

export const updateTenantStatsByAadhaar = async (aadhaarNumber: string): Promise<ScoreDetails> => {
  if (!aadhaarNumber) {
    return {
      score: 700,
      averageRating: 5.0,
      riskLevel: 'low',
      feedbacks: []
    };
  }

  let score = 700; // Base score

  // 1. Fetch reviews from TenantReview
  const reviews = await TenantReview.find({ aadhaarNumber });
  const feedbacks: string[] = [];
  let totalRatingSum = 0;

  for (const review of reviews) {
    feedbacks.push(review.feedback);
    totalRatingSum += review.rating;

    if (review.rating === 5) {
      score += 30;
    } else if (review.rating === 4) {
      score += 15;
    } else if (review.rating === 3) {
      score += 0;
    } else if (review.rating === 2) {
      score -= 40;
    } else if (review.rating === 1) {
      score -= 80;
    }
  }

  const averageRating = reviews.length > 0
    ? parseFloat((totalRatingSum / reviews.length).toFixed(1))
    : 5.0;

  // 2. Fetch payments for all tenant records with this Aadhaar
  const tenants = await Tenant.find({ aadhaarNumber }).select('_id');
  const tenantIds = tenants.map((t) => t._id);

  const payments = await Payment.find({ tenant: { $in: tenantIds } });
  const now = new Date();

  for (const payment of payments) {
    if (payment.status === 'paid') {
      if (payment.paymentDate && payment.dueDate) {
        const payDate = new Date(payment.paymentDate);
        const dueDate = new Date(payment.dueDate);
        if (payDate <= dueDate) {
          score += 5;
        } else {
          score -= 15;
        }
      } else {
        score += 5; // Default fallback for paid payments with missing dates
      }
    } else if (
      payment.status === 'overdue' ||
      (payment.status === 'unpaid' && now > new Date(payment.dueDate))
    ) {
      score -= 30;
    }
  }

  // 3. Clamp the score between 300 and 850
  score = Math.max(300, Math.min(850, score));

  // 4. Derive risk level
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (score < 600) {
    riskLevel = 'high';
  } else if (score < 750) {
    riskLevel = 'medium';
  }

  // 5. Update all matching Tenant records in the database
  await Tenant.updateMany(
    { aadhaarNumber },
    {
      $set: {
        creditScore: score,
        tenantRating: averageRating,
        riskLevel,
        previousOwnerFeedback: feedbacks
      }
    }
  );

  return {
    score,
    averageRating,
    riskLevel,
    feedbacks
  };
};
