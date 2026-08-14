/**
 * Feature gating logic for the TopKorbo EdTech platform.
 * Use this utility to check if a user has access to a specific feature.
 * 
 * @param {string} feature - The feature identifier
 * @param {string} authState - 'guest' | 'authenticated'
 * @param {string} subscription - 'free' | 'pro' | 'pro_plus'
 * @returns {string} - 'allowed' | 'login_required' | 'upgrade_required'
 */
export function canAccessFeature(feature, authState, subscription) {
  if (authState === 'guest') {
    return 'login_required';
  }

  // Define the minimum subscription level required for each feature
  const featureRequirements = {
    'qbank_exams': 'free',
    'mock_tests': 'free',
    'battle_rooms': 'free',
    'ai_mentor': 'free',
    'books': 'free',
    'ai_study_planner': 'pro',
    'personalized_routine': 'pro',
    'advanced_analytics': 'pro',
    'reading_tools': 'pro_plus',
    'reading_ai': 'pro_plus',
  };

  const requiredPlan = featureRequirements[feature] || 'free';

  const planRank = {
    'free': 0,
    'pro': 1,
    'pro_plus': 2
  };

  const userRank = planRank[subscription] || 0;
  const neededRank = planRank[requiredPlan] || 0;

  if (userRank >= neededRank) {
    return 'allowed';
  }

  return 'upgrade_required';
}

/**
 * Utility hook wrapper if you want to use it easily in React components.
 * Example:
 * const { accessStatus } = useFeatureAccess('reading_ai');
 */
