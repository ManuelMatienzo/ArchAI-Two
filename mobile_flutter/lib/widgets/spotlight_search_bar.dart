import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../models/uml_model.dart';
import '../theme/app_colors.dart';

class SpotlightSearchBar extends StatefulWidget {
  final List<UmlClass> classes;
  final void Function(UmlClass selected) onSelectClass;
  final VoidCallback onClose;

  const SpotlightSearchBar({
    super.key,
    required this.classes,
    required this.onSelectClass,
    required this.onClose,
  });

  @override
  State<SpotlightSearchBar> createState() => _SpotlightSearchBarState();
}

class _SpotlightSearchBarState extends State<SpotlightSearchBar> {
  final TextEditingController _controller = TextEditingController();
  List<UmlClass> _filtered = [];

  @override
  void initState() {
    super.initState();
    _filtered = widget.classes;
    _controller.addListener(_filter);
  }

  void _filter() {
    final q = _controller.text.trim().toLowerCase();
    if (q.isEmpty) {
      setState(() => _filtered = widget.classes);
      return;
    }

    setState(() {
      _filtered = widget.classes.where((c) {
        if (c.name.toLowerCase().contains(q)) return true;
        if (c.stereotype.toLowerCase().contains(q)) return true;
        return c.attributes.any((a) => a.name.toLowerCase().contains(q));
      }).toList();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceGlass,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withAlpha(120), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withAlpha(150),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const Icon(LucideIcons.search, size: 20, color: AppColors.primary),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _controller,
                  autofocus: true,
                  style: const TextStyle(fontSize: 14, color: AppColors.textPrimary),
                  decoration: const InputDecoration(
                    hintText: 'Buscar clase, estereotipo o atributo...',
                    hintStyle: TextStyle(fontSize: 13, color: AppColors.textMuted),
                    border: InputBorder.none,
                    isDense: true,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(LucideIcons.x, size: 18, color: AppColors.textMuted),
                onPressed: widget.onClose,
                padding: EdgeInsets.zero,
                constraints: const BoxConstraints(),
              ),
            ],
          ),
          if (_filtered.isNotEmpty) ...[
            const Divider(color: AppColors.borderGlass, height: 16),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 220),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: _filtered.length,
                separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.borderGlass),
                itemBuilder: (context, idx) {
                  final c = _filtered[idx];
                  return ListTile(
                    dense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                    title: Text(
                      c.name,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    subtitle: Text(
                      '«${c.stereotype}» · ${c.attributes.length} attrs, ${c.methods.length} métodos',
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                    trailing: const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.primary),
                    onTap: () => widget.onSelectClass(c),
                  );
                },
              ),
            ),
          ] else ...[
            const SizedBox(height: 12),
            const Text(
              'No se encontraron clases coincidentes',
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          ],
        ],
      ),
    );
  }
}
