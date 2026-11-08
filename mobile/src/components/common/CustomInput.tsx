import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { colors } from '../../theme/colors';

interface CustomInputProps extends TextInputProps {
  label: string;
  icon?: React.ReactNode;
  isPassword?: boolean;
}

export const CustomInput: React.FC<CustomInputProps> = ({
  label,
  icon,
  isPassword = false,
  style,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!isPassword);

  return (
    <View style={styles.container}>
      <Text style={[styles.label, isFocused && styles.labelFocused]}>
        {label}
      </Text>

      <View style={[styles.inputBox, isFocused && styles.inputBoxFocused]}>
        {/* Barra de acento vertical al enfocar */}
        <View
          style={[styles.focusBar, isFocused && styles.focusBarActive]}
          pointerEvents="none"
        />

        {icon && <View style={styles.iconContainer}>{icon}</View>}

        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={isPassword && !showPassword}
          selectionColor={colors.primary}
          cursorColor={colors.primary}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={
              showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
            }
          >
            {showPassword ? (
              <EyeOff size={17} color={colors.textMuted} />
            ) : (
              <Eye size={17} color={colors.textMuted} />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  label: {
    fontSize: 9.5,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  labelFocused: {
    color: colors.primary,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceInput,
    borderWidth: 1.2,
    borderColor: 'rgba(232, 195, 158, 0.18)',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 52,
    overflow: 'hidden',
  },
  inputBoxFocused: {
    borderColor: 'rgba(232, 195, 158, 0.75)',
    backgroundColor: 'rgba(23, 26, 74, 0.80)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 2,
  },
  focusBar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 2.5,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  focusBarActive: {
    backgroundColor: colors.primary,
  },
  iconContainer: {
    width: 30,
    height: 30,
    borderRadius: 9,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(232, 195, 158, 0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(232, 195, 158, 0.16)',
  },
  input: {
    flex: 1,
    fontSize: 14.5,
    color: colors.textPrimary,
    fontWeight: '600',
    height: '100%',
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 4,
  },
});
