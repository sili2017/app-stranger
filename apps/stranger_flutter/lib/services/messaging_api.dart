import '../core/api_client.dart';
import '../models/chat.dart';

class MessagingApi {
  MessagingApi(this._client);
  final ApiClient _client;

  Future<List<Chat>> listConversations() async {
    final json = await _client.get('/conversations') as List;
    return json.map((e) => Chat.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<ChatMessage>> listMessages(String chatId) async {
    final json = await _client.get('/conversations/$chatId/messages') as List;
    return json
        .map((e) => ChatMessage.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ChatMessage> sendMessage(String chatId, String body) async {
    final json = await _client
        .post('/conversations/$chatId/messages', body: {'body': body});
    return ChatMessage.fromJson(json as Map<String, dynamic>);
  }
}
