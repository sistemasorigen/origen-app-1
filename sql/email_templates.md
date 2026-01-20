# 📧 Email Templates Neo-Brutalistas para Supabase Auth

Copia estos templates en **Supabase Dashboard → Authentication → Email Templates**

---

## 1. Confirm Signup (Confirmación de Email)

**Subject:** `¡Confirmá tu cuenta en Origen App!`

**HTML Body:**
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmá tu cuenta</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 4px solid #000000; box-shadow: 8px 8px 0px #000000;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #000000; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">
                🎉 ¡BIENVENIDO A ORIGEN!
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 18px; color: #333333; line-height: 1.6;">
                ¡Hola! Estás a un paso de unirte a nuestra comunidad.
              </p>
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #555555; line-height: 1.6;">
                Hacé clic en el botón para confirmar tu email y activar tu cuenta:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" 
                       style="display: inline-block; 
                              background-color: #000000; 
                              color: #ffffff; 
                              font-size: 16px; 
                              font-weight: 700; 
                              text-transform: uppercase; 
                              letter-spacing: 1px;
                              text-decoration: none; 
                              padding: 18px 40px; 
                              border: 3px solid #000000;
                              box-shadow: 4px 4px 0px #fef08a;">
                      ✓ CONFIRMAR MI EMAIL
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 30px 0 0 0; font-size: 13px; color: #888888; text-align: center;">
                Si el botón no funciona, copiá y pegá este link en tu navegador:
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #666666; text-align: center; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          
          <!-- Warning Box -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background-color: #fef3c7; border: 3px solid #000000; padding: 16px 20px; box-shadow: 4px 4px 0px #000000;">
                <p style="margin: 0; font-size: 13px; color: #92400e; font-weight: 600;">
                  ⚠️ Este link expira en 24 horas. Si no creaste esta cuenta, ignorá este email.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #000000; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #888888;">
                © 2026 Origen App · Grupos de Conexión
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 2. Reset Password (Recuperar Contraseña)

**Subject:** `🔐 Recuperá tu contraseña - Origen App`

**HTML Body:**
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperar contraseña</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 4px solid #000000; box-shadow: 8px 8px 0px #000000;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #000000; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">
                🔐 RECUPERAR CONTRASEÑA
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 18px; color: #333333; line-height: 1.6;">
                ¡Hola! Recibimos una solicitud para restablecer tu contraseña.
              </p>
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #555555; line-height: 1.6;">
                Hacé clic en el botón para crear una nueva contraseña:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" 
                       style="display: inline-block; 
                              background-color: #dc2626; 
                              color: #ffffff; 
                              font-size: 16px; 
                              font-weight: 700; 
                              text-transform: uppercase; 
                              letter-spacing: 1px;
                              text-decoration: none; 
                              padding: 18px 40px; 
                              border: 3px solid #000000;
                              box-shadow: 4px 4px 0px #000000;">
                      🔑 CAMBIAR CONTRASEÑA
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 30px 0 0 0; font-size: 13px; color: #888888; text-align: center;">
                Si el botón no funciona, copiá y pegá este link:
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #666666; text-align: center; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          
          <!-- Warning Box -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background-color: #fee2e2; border: 3px solid #000000; padding: 16px 20px; box-shadow: 4px 4px 0px #000000;">
                <p style="margin: 0; font-size: 13px; color: #991b1b; font-weight: 600;">
                  ⚠️ Si no solicitaste este cambio, ignorá este email. Tu contraseña seguirá siendo la misma.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #000000; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #888888;">
                © 2026 Origen App · Grupos de Conexión
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 3. Magic Link (Inicio de Sesión sin Contraseña)

**Subject:** `🔗 Tu link de acceso - Origen App`

**HTML Body:**
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Magic Link</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 4px solid #000000; box-shadow: 8px 8px 0px #000000;">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #000000; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px;">
                🔗 TU LINK DE ACCESO
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px 0; font-size: 18px; color: #333333; line-height: 1.6;">
                ¡Hola! Solicitaste un link para iniciar sesión.
              </p>
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #555555; line-height: 1.6;">
                Hacé clic en el botón para acceder a tu cuenta:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" 
                       style="display: inline-block; 
                              background-color: #7c3aed; 
                              color: #ffffff; 
                              font-size: 16px; 
                              font-weight: 700; 
                              text-transform: uppercase; 
                              letter-spacing: 1px;
                              text-decoration: none; 
                              padding: 18px 40px; 
                              border: 3px solid #000000;
                              box-shadow: 4px 4px 0px #000000;">
                      🚀 INICIAR SESIÓN
                    </a>
                  </td>
                </tr>
              </table>
              
              <!-- Alternative Link -->
              <p style="margin: 30px 0 0 0; font-size: 13px; color: #888888; text-align: center;">
                Si el botón no funciona, copiá y pegá este link:
              </p>
              <p style="margin: 8px 0 0 0; font-size: 12px; color: #666666; text-align: center; word-break: break-all;">
                {{ .ConfirmationURL }}
              </p>
            </td>
          </tr>
          
          <!-- Info Box -->
          <tr>
            <td style="padding: 0 40px 30px 40px;">
              <div style="background-color: #ede9fe; border: 3px solid #000000; padding: 16px 20px; box-shadow: 4px 4px 0px #000000;">
                <p style="margin: 0; font-size: 13px; color: #5b21b6; font-weight: 600;">
                  ⏱️ Este link expira en 1 hora y solo puede usarse una vez.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #000000; padding: 24px 40px; text-align: center;">
              <p style="margin: 0; font-size: 13px; color: #888888;">
                © 2026 Origen App · Grupos de Conexión
              </p>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

## 📍 Cómo configurar en Supabase

1. Ir a **Supabase Dashboard** → tu proyecto
2. Click en **Authentication** (menú izquierdo)
3. Click en **Email Templates** (submenu)
4. Para cada template:
   - Seleccionar el tipo (Confirm signup, Reset password, etc.)
   - Pegar el **Subject**
   - Pegar el **HTML Body** (sin los backticks del markdown)
   - Click **Save**

---

## ✅ Variables disponibles

| Variable | Descripción |
|----------|-------------|
| `{{ .ConfirmationURL }}` | Link completo de confirmación/acción |
| `{{ .Email }}` | Email del usuario |
| `{{ .Token }}` | Token (para OTP) |
| `{{ .TokenHash }}` | Hash del token |
| `{{ .SiteURL }}` | URL de tu sitio |
