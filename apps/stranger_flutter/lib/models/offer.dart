/// Mirrors services/offer's MeetOffer response shape (contracts/public/offer-service.md).
class MeetOffer {
  MeetOffer({
    required this.id,
    required this.creatorUserId,
    required this.cityId,
    required this.activityText,
    required this.placeKind,
    this.placeLabel,
    required this.placeLat,
    required this.placeLng,
    this.rendezvousInstruction,
    required this.lifetimeMinutes,
    required this.capacity,
    required this.status,
    required this.publishedAt,
    required this.expiresAt,
    required this.interestCount,
    this.moneyPreferenceLabel,
    this.moneyPreferenceNote,
  });

  final String id;
  final String creatorUserId;
  final String cityId;
  final String activityText;
  final String placeKind;
  final String? placeLabel;
  final double placeLat;
  final double placeLng;
  final String? rendezvousInstruction;
  final int lifetimeMinutes;
  final int capacity;
  final String status;
  final DateTime publishedAt;
  final DateTime expiresAt;
  final int interestCount;
  final String? moneyPreferenceLabel;
  final String? moneyPreferenceNote;

  bool get isActive => status == 'active';

  Duration get timeRemaining => expiresAt.difference(DateTime.now());

  factory MeetOffer.fromJson(Map<String, dynamic> json) => MeetOffer(
        id: json['id'] as String,
        creatorUserId: json['creatorUserId'] as String,
        cityId: json['cityId'] as String,
        activityText: json['activityText'] as String,
        placeKind: json['placeKind'] as String,
        placeLabel: json['placeLabel'] as String?,
        placeLat: (json['placeLat'] as num).toDouble(),
        placeLng: (json['placeLng'] as num).toDouble(),
        rendezvousInstruction: json['rendezvousInstruction'] as String?,
        lifetimeMinutes: json['lifetimeMinutes'] as int,
        capacity: json['capacity'] as int,
        status: json['status'] as String,
        publishedAt: DateTime.parse(json['publishedAt'] as String),
        expiresAt: DateTime.parse(json['expiresAt'] as String),
        interestCount: json['interestCount'] as int,
        moneyPreferenceLabel: json['moneyPreferenceLabel'] as String?,
        moneyPreferenceNote: json['moneyPreferenceNote'] as String?,
      );
}

/// Mirrors discovery-location's /discovery/feed item — deliberately narrower than
/// MeetOffer (no exact lat/lng, only a distanceBand — constitution §3.IV).
class DiscoveryFeedItem {
  DiscoveryFeedItem({
    required this.offerId,
    required this.cityId,
    required this.placeKind,
    required this.activityText,
    required this.capacity,
    required this.interestCount,
    required this.publishedAt,
    required this.expiresAt,
    required this.distanceBand,
  });

  final String offerId;
  final String cityId;
  final String placeKind;
  final String activityText;
  final int capacity;
  final int interestCount;
  final DateTime publishedAt;
  final DateTime expiresAt;
  final String distanceBand;

  Duration get timeRemaining => expiresAt.difference(DateTime.now());

  factory DiscoveryFeedItem.fromJson(Map<String, dynamic> json) =>
      DiscoveryFeedItem(
        offerId: json['offerId'] as String,
        cityId: json['cityId'] as String,
        placeKind: json['placeKind'] as String,
        activityText: json['activityText'] as String,
        capacity: json['capacity'] as int,
        interestCount: json['interestCount'] as int,
        publishedAt: DateTime.parse(json['publishedAt'] as String),
        expiresAt: DateTime.parse(json['expiresAt'] as String),
        distanceBand: json['distanceBand'] as String,
      );
}
