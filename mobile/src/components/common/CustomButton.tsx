import React from 'react';
import {
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

interface CustomButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  icon?: React.ReactNode;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const PRESS_IN = { duration: 90, easing: Easing.out(Easing.quad) };
const PRESS_OUT = { duration: 180, easing: Easing.out(Easing.cubic) };

export const CustomButton: React.FC<CustomButtonProps> = ({
  title,
  variant = 'primary',
  loading = false,
  icon,
  style,
  disabled,
  onPressIn,
  onPressOut,
  ...props
}) => {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';

  // Micro-interacción en el hilo de UI: no provoca re-renders.
  const pressed = useSharedValue(0);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.022 }],
    opacity: 1 - pressed.value * 0.06,
  }));

  return (
    <AnimatedTouchable
      style={[
        styles.base,
        isPrimary && styles.primary,
        isSecondary && styles.secondary,
        variant === 'outline' && styles.outline,
        disabled && styles.disabled,
        pressStyle,
        style,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: loading }}
      onPressIn={(event) => {
        pressed.value = withTiming(1, PRESS_IN);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        pressed.value = withTiming(0, PRESS_OUT);
        onPressOut?.(event);
      }}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? colors.textOnPrimary : colors.primary}
        />
      ) : (
        <View style={styles.content}>
          <Text
            style={[
              styles.text,
              isPrimary && styles.textPrimary,
              isSecondary && styles.textSecondary,
              variant === 'outline' && styles.textOutline,
            ]}
          >
            {title}
          </Text>
          {icon && <View style={styles.iconSlot}>{icon}</View>}
        </View>
      )}
    </AnimatedTouchable>
  );
};

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  primary: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 5,
  },
  secondary: {
    backgroundColor: 'rgba(47, 44, 121, 0.45)',
    borderWidth: 1.2,
    borderColor: 'rgba(232, 195, 158, 0.30)',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderInput,
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  text: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  textPrimary: {
    color: colors.textOnPrimary,
  },
  textSecondary: {
    color: colors.textPrimary,
  },
  textOutline: {
    color: colors.textSecondary,
  },
  iconSlot: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
