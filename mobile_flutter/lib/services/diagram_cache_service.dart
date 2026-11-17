import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../api/rooms_api.dart';
import '../models/uml_model.dart';

class DiagramCacheService {
  static final DiagramCacheService instance = DiagramCacheService._internal();
  DiagramCacheService._internal();

  final Map<String, DiagramData> _l1MemoryCache = {};

  static const String _keyPrefix = 'archai_diagram_cache_';

  Future<void> saveDiagram(String roomId, List<UmlClass> classes, List<UmlRelationship> relationships) async {
    final data = DiagramData(classes: classes, relationships: relationships);
    _l1MemoryCache[roomId] = data;

    try {
      final prefs = await SharedPreferences.getInstance();
      final map = {
        'classes': classes.map((c) => c.toJson()).toList(),
        'relationships': relationships.map((r) => r.toJson()).toList(),
        'cachedAt': DateTime.now().toIso8601String(),
      };
      await prefs.setString('$_keyPrefix$roomId', jsonEncode(map));
    } catch (_) {}
  }

  Future<DiagramData?> getDiagram(String roomId) async {
    if (_l1MemoryCache.containsKey(roomId)) {
      return _l1MemoryCache[roomId];
    }

    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString('$_keyPrefix$roomId');
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map<String, dynamic>) {
          final data = RoomsApi.parseBackendDiagram(decoded);
          _l1MemoryCache[roomId] = data;
          return data;
        }
      }
    } catch (_) {}

    return null;
  }

  Future<void> clear(String roomId) async {
    _l1MemoryCache.remove(roomId);
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('$_keyPrefix$roomId');
    } catch (_) {}
  }

  Future<void> clearAll() async {
    _l1MemoryCache.clear();
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs.getKeys().where((k) => k.startsWith(_keyPrefix)).toList();
      for (final k in keys) {
        await prefs.remove(k);
      }
    } catch (_) {}
  }
}
