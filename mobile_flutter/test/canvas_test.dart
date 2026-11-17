import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_flutter/api/rooms_api.dart';
import 'package:mobile_flutter/models/auth_model.dart';
import 'package:mobile_flutter/models/uml_model.dart';
import 'package:mobile_flutter/screens/canvas_viewer_screen.dart';
import 'package:mobile_flutter/widgets/class_card_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('normaliza clases, relaciones y diagrama vacío', () {
    final diagram = RoomsApi.parseBackendDiagram({
      'classes': [
        {'id': 'a', 'name': 'Cliente', 'position': {'x': 25, 'y': 35}, 'attributes': [{'name': 'id', 'type': 'Long'}]},
        {'id': 'b', 'name': 'Pedido', 'x': 300, 'y': 50},
      ],
      'relations': [
        {'id': 'r', 'sourceClassId': 'a', 'targetClassId': 'b', 'type': 'composition'},
        {'id': 'bad', 'sourceClassId': 'a', 'targetClassId': 'missing'},
      ],
    });
    expect(diagram.classes.first.x, 25);
    expect(diagram.classes.first.attributes.first.isPrimaryKey, isTrue);
    expect(diagram.relationships.single.type, 'COMPOSITION');
    expect(RoomsApi.parseBackendDiagram({'classes': [], 'relations': []}).classes, isEmpty);
  });

  testWidgets('el lienzo permite inspección sin mover las clases', (tester) async {
    final entity = UmlClass(id: 'a', name: 'Cliente', x: 60, y: 80, attributes: [], methods: []);
    final user = UserModel(id: 'u', name: 'Ana', email: 'ana@example.com', role: 'EDITOR');
    await tester.pumpWidget(MaterialApp(home: CanvasViewerScreen(
      session: UserSession(token: '', user: user), roomId: 'SANDBOX-OFFLINE',
      roomName: 'Sala', initialClasses: [entity], initialRelationships: [],
    )));
    await tester.pumpAndSettle();
    expect(find.text('Cliente'), findsOneWidget);
    await tester.drag(find.byType(ClassCardWidget), const Offset(50, 30));
    await tester.pumpAndSettle();
    expect(entity.x, 60);
    expect(entity.y, 80);
    await tester.tap(find.byType(ClassCardWidget));
    await tester.pumpAndSettle();
    expect(find.text('Cliente'), findsWidgets);
  });
}
