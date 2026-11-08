import React from 'react';

interface GlassTextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  label?: string;
  labelStyle?: React.CSSProperties;
  error?: string;
}

export const GlassTextField: React.FC<GlassTextFieldProps> = ({
  leadingIcon,
  trailingIcon,
  label,
  labelStyle,
  error,
  style,
  ...props
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label
          className="glass-textfield-label"
          style={{
            fontSize: '0.8rem',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            letterSpacing: '0.01em',
            ...labelStyle
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {leadingIcon && (
          <div style={{
            position: 'absolute',
            left: '14px',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-subtle)'
          }}>
            {leadingIcon}
          </div>
        )}
        <input
          className="glass-textfield"
          style={{
            paddingLeft: leadingIcon ? '40px' : '16px',
            paddingRight: trailingIcon ? '40px' : '16px',
            borderColor: error ? 'var(--glass-error)' : undefined,
            ...style
          }}
          {...props}
        />
        {trailingIcon && (
          <div style={{
            position: 'absolute',
            right: '14px',
            display: 'flex',
            alignItems: 'center',
            color: 'var(--text-subtle)'
          }}>
            {trailingIcon}
          </div>
        )}
      </div>
      {error && (
        <span style={{ fontSize: '0.72rem', color: 'var(--glass-error)' }}>
          {error}
        </span>
      )}
    </div>
  );
};
