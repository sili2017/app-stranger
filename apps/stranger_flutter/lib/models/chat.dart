class Chat {
  Chat(
      {required this.id,
      required this.offerId,
      required this.status,
      required this.createdAt});

  final String id;
  final String offerId;
  final String status;
  final DateTime createdAt;

  bool get isActive => status == 'active';

  factory Chat.fromJson(Map<String, dynamic> json) => Chat(
        id: json['id'] as String,
        offerId: json['offerId'] as String,
        status: json['status'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}

class ChatMessage {
  ChatMessage({
    required this.id,
    required this.chatId,
    required this.senderId,
    required this.body,
    required this.createdAt,
  });

  final String id;
  final String chatId;
  final String senderId;
  final String body;
  final DateTime createdAt;

  factory ChatMessage.fromJson(Map<String, dynamic> json) => ChatMessage(
        id: json['id'] as String,
        chatId: json['chatId'] as String,
        senderId: json['senderId'] as String,
        body: json['body'] as String,
        createdAt: DateTime.parse(json['createdAt'] as String),
      );
}
