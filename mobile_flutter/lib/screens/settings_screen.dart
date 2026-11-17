import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../api/client.dart';
import '../config/app_config.dart';
import '../services/diagram_cache_service.dart';
import '../theme/app_colors.dart';
import '../widgets/glass_card.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final TextEditingController _urlController = TextEditingController();
  bool _isLoading = false;
  String? _statusMessage;
  bool _isSuccess = false;

  @override
  void initState() {
    super.initState();
    _loadCurrentSettings();
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _loadCurrentSettings() async {
    final url = await AppConfig.getBackendUrl();
    setState(() {
      _urlController.text = url;
    });
  }

  Future<void> _saveUrl() async {
    final text = _urlController.text.trim();
    if (text.isEmpty) return;

    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      await AppConfig.setBackendUrl(text);
      final updated = await AppConfig.getBackendUrl();
      _urlController.text = updated;

      setState(() {
        _isSuccess = true;
        _statusMessage = 'Dirección del servidor actualizada correctamente.';
      });
    } catch (e) {
      setState(() {
        _isSuccess = false;
        _statusMessage = e.toString();
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _testConnection() async {
    setState(() {
      _isLoading = true;
      _statusMessage = null;
    });

    try {
      // Test request to real backend endpoint
      await ApiClient.request('/colaboracion/salas');
      setState(() {
        _isSuccess = true;
        _statusMessage = 'Conexión exitosa con el servidor.';
      });
    } catch (_) {
      setState(() {
        _isSuccess = false;
        _statusMessage = 'No se pudo conectar con el servidor. Verifica que esté en ejecución en la misma red Wi-Fi.';
      });
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _clearCache() async {
    await DiagramCacheService.instance.clearAll();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Caché local de diagramas vaciado')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceGlass,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft, size: 20, color: AppColors.textPrimary),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          'Configuración del Servidor',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(LucideIcons.server, color: AppColors.primary, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Dirección de la API Backend',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Configura la dirección HTTP del servidor Spring Boot local o en la nube para sincronizar proyectos y salas en vivo.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                  ),
                  const SizedBox(height: 14),
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.surfaceLight,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.borderGlass),
                    ),
                    child: TextField(
                      controller: _urlController,
                      style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
                      decoration: const InputDecoration(
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                        border: InputBorder.none,
                        isDense: true,
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  if (_statusMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: _isSuccess
                            ? AppColors.accentEmerald.withAlpha(30)
                            : AppColors.accentRose.withAlpha(30),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: _isSuccess
                              ? AppColors.accentEmerald.withAlpha(100)
                              : AppColors.accentRose.withAlpha(100),
                        ),
                      ),
                      child: Text(
                        _statusMessage!,
                        style: TextStyle(
                          fontSize: 12,
                          color: _isSuccess ? AppColors.accentEmerald : AppColors.accentRose,
                        ),
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],

                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.textPrimary,
                            side: const BorderSide(color: AppColors.borderGlass),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: _isLoading ? null : _testConnection,
                          child: const Text('Probar Conexión', style: TextStyle(fontSize: 12)),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.black,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: _isLoading ? null : _saveUrl,
                          child: const Text('Guardar', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            GlassCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Row(
                    children: [
                      Icon(LucideIcons.hardDrive, color: AppColors.secondary, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Almacenamiento y Caché Local',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Elimina los diagramas y salas guardados en la memoria persistente del dispositivo.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary, height: 1.4),
                  ),
                  const SizedBox(height: 14),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.accentRose,
                      side: const BorderSide(color: AppColors.accentRose),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                    icon: const Icon(LucideIcons.trash2, size: 18),
                    label: const Text('Limpiar Todo el Caché Local', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: _clearCache,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
