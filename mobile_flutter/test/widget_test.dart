import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_flutter/main.dart';

void main() {
  testWidgets('ArchAI app smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const ArchAiApp());
    expect(find.byType(ArchAiApp), findsOneWidget);
  });
}
