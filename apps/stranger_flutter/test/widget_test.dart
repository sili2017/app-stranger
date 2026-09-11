import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:stranger_flutter/core/session.dart';
import 'package:stranger_flutter/main.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  testWidgets('shows the dev sign-in screen when no session exists', (
    WidgetTester tester,
  ) async {
    final session = await Session.load();
    await tester.pumpWidget(StrangerApp(session: session));

    expect(find.text('Stranger'), findsOneWidget);
    expect(find.text('Continue'), findsOneWidget);
  });

  testWidgets('goes straight to the home shell when a session already exists', (
    WidgetTester tester,
  ) async {
    SharedPreferences.setMockInitialValues({'dev_user_id': 'alice'});
    final session = await Session.load();
    await tester.pumpWidget(StrangerApp(session: session));
    await tester.pump();

    expect(find.text('Discover'), findsWidgets);
  });
}
