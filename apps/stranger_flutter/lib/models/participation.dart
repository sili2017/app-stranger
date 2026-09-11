class ExpressionOfInterest {
  ExpressionOfInterest({
    required this.id,
    required this.offerId,
    required this.recipientUserId,
    this.message,
    required this.createdAt,
  });

  final String id;
  final String offerId;
  final String recipientUserId;
  final String? message;
  final DateTime createdAt;

  factory ExpressionOfInterest.fromJson(Map<String, dynamic> json) =>
      ExpressionOfInterest(
        id: json['id'] as String,
        offerId: json['offerId'] as String,
        recipientUserId: json['recipientUserId'] as String,
        message: json['message'] as String?,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class Selection {
  Selection({
    required this.id,
    required this.offerId,
    required this.expressionOfInterestId,
    required this.recipientUserId,
    required this.outcome,
  });

  final String id;
  final String offerId;
  final String expressionOfInterestId;
  final String recipientUserId;
  final String outcome;

  factory Selection.fromJson(Map<String, dynamic> json) => Selection(
        id: json['id'] as String,
        offerId: json['offerId'] as String,
        expressionOfInterestId: json['expressionOfInterestId'] as String,
        recipientUserId: json['recipientUserId'] as String,
        outcome: json['outcome'] as String,
      );
}
