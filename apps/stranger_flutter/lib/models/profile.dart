class PublicProfile {
  PublicProfile({
    required this.userId,
    required this.firstName,
    this.photoAssetId,
    required this.ageRangeLabel,
    required this.interests,
    required this.verificationStatus,
    required this.languagePreference,
    this.publicRatingAverage,
    required this.publicRatingCount,
  });

  final String userId;
  final String firstName;
  final String? photoAssetId;
  final String ageRangeLabel;
  final List<String> interests;
  final String verificationStatus;
  final String languagePreference;
  final double? publicRatingAverage;
  final int publicRatingCount;

  factory PublicProfile.fromJson(Map<String, dynamic> json) => PublicProfile(
        userId: json['userId'] as String,
        firstName: (json['firstName'] as String?) ?? '',
        photoAssetId: json['photoAssetId'] as String?,
        ageRangeLabel: json['ageRangeLabel'] as String,
        interests: (json['interests'] as List?)?.cast<String>() ?? const [],
        verificationStatus: json['verificationStatus'] as String,
        languagePreference: json['languagePreference'] as String,
        publicRatingAverage: (json['publicRatingAverage'] as num?)?.toDouble(),
        publicRatingCount: json['publicRatingCount'] as int,
      );
}

class Entitlements {
  Entitlements({
    required this.remainingFreeAllowanceThisMonth,
    required this.hasActiveSubscription,
    this.subscriptionPlan,
    this.subscriptionStatus,
    required this.availableOneTimePurchases,
  });

  final int remainingFreeAllowanceThisMonth;
  final bool hasActiveSubscription;
  final String? subscriptionPlan;
  final String? subscriptionStatus;
  final int availableOneTimePurchases;

  bool get canPublish =>
      hasActiveSubscription ||
      remainingFreeAllowanceThisMonth > 0 ||
      availableOneTimePurchases > 0;

  factory Entitlements.fromJson(Map<String, dynamic> json) {
    final subscription = json['subscription'] as Map<String, dynamic>?;
    return Entitlements(
      remainingFreeAllowanceThisMonth:
          json['remainingFreeAllowanceThisMonth'] as int,
      hasActiveSubscription: json['hasActiveSubscription'] as bool,
      subscriptionPlan: subscription?['plan'] as String?,
      subscriptionStatus: subscription?['status'] as String?,
      availableOneTimePurchases: json['availableOneTimePurchases'] as int,
    );
  }
}
