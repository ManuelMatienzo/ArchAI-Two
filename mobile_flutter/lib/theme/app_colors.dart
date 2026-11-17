import 'package:flutter/material.dart';

class AppColors {
  // Paleta principal Glassmorphism oscuro (Deep Indigo & Navy)
  static const Color background = Color(0xFF0A0C1E);
  static const Color backgroundDark = Color(0xFF0A0C1E);
  static const Color canvasGridBackground = Color(0xFF060814);

  static const Color surface = Color(0xFF13163D);
  static const Color surfaceGlass = Color(0xCC13163D);
  static const Color surfaceModal = Color(0xF0101333);
  static const Color surfaceLight = Color(0x3338BDF8);
  static const Color surfaceHover = Color(0xFF1E2256);
  static const Color surfaceHeader = Color(0xFF1B1F4F);
  static const Color surfaceGhost = Color(0xD9171A4A);

  // Warm Sand (identidad oficial de contraste) & Cyan
  static const Color primary = Color(0xFFE8C39E);
  static const Color warmSand = Color(0xFFE8C39E);
  static const Color warmSandLight = Color(0xFFF5E1CE);
  static const Color warmSandMuted = Color(0x99E8C39E);

  static const Color secondary = Color(0xFF38BDF8);
  static const Color cyanAccent = Color(0xFF38BDF8);
  static const Color accentEmerald = Color(0xFF10B981);
  static const Color emeraldAccent = Color(0xFF10B981);
  static const Color accentRose = Color(0xFFFB7185);
  static const Color roseAccent = Color(0xFFFB7185);
  static const Color amberAccent = Color(0xFFF59E0B);
  static const Color purpleAccent = Color(0xFFA855F7);

  // Bordes y separadores sutiles
  static const Color border = Color(0x33E8C39E);
  static const Color borderGlass = Color(0x33E8C39E);
  static const Color borderSubtle = Color(0x1AE8C39E);
  static const Color borderFocused = Color(0xFF38BDF8);
  static const Color ghostBorder = Color(0xFF38BDF8);

  // Textos
  static const Color textPrimary = Color(0xFFF8FAFC);
  static const Color textSecondary = Color(0xFF94A3B8);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textSand = Color(0xFFE8C39E);

  static ThemeData get themeData {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: backgroundDark,
      primaryColor: primary,
      colorScheme: const ColorScheme.dark(
        primary: primary,
        secondary: secondary,
        surface: surface,
        error: accentRose,
        onPrimary: Colors.black,
        onSecondary: Colors.black,
        onSurface: textPrimary,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: surfaceGlass,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: TextStyle(
          color: textPrimary,
          fontSize: 16,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
