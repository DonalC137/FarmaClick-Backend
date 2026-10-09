import re

with open('frontend/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove 'Oracle Cloud' references globally
content = content.replace(' en Oracle Cloud', '')
content = content.replace(' Oracle Cloud', '')
content = content.replace(' Oracle Autonomous Cloud', '')
content = content.replace('Oracle Cloud', '')
content = content.replace('Oracle Autonomous Cloud', '')
content = content.replace('(Oracle Cloud)', '')
content = content.replace('(Oracle Autonomous Cloud)', '')

# Re-structure the login screen (remove left panel and quick access)
login_screen_new = '''
    <div id="loginScreen">
        <div class="login-right" style="width: 100%; border-left: none; background: transparent; display: flex; align-items: center; justify-content: center;">
            <div style="background: var(--card); padding: 50px; border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow); width: 100%; max-width: 440px; position: relative; z-index: 10;">
                <div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 30px;">
                    <div style="width: 56px; height: 56px; background: linear-gradient(135deg, var(--primary), var(--primary-dark)); border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; color: #0d1117; margin-bottom: 16px; box-shadow: 0 0 24px var(--primary-glow);">
                        <i class="fa-solid fa-prescription-bottle-medical"></i>
                    </div>
                    <h2 style="font-size: 1.8rem; font-weight: 800; color: var(--text); letter-spacing: -0.5px;">FarmaClick</h2>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 4px;">Accede con tus credenciales asignadas</p>
                </div>

                <form onsubmit="handleLogin(event)" style="width:100%">
                    <div class="form-group">
                        <label>Correo Electrónico</label>
                        <div class="input-with-icon">
                            <input type="email" id="loginCorreo" class="form-input" placeholder="usuario@farmaclick.com" required>
                            <i class="fa-solid fa-envelope input-icon"></i>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Contraseña</label>
                        <div class="input-with-icon">
                            <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required>
                            <i class="fa-solid fa-lock input-icon"></i>
                        </div>
                    </div>
                    <button type="submit" class="btn-login" id="btnLoginSubmit" style="margin-top: 10px;">
                        <i class="fa-solid fa-right-to-bracket"></i> Iniciar Sesión
                    </button>
                </form>
            </div>
        </div>
    </div>
'''

# Replace the old loginScreen with the new one
content = re.sub(r'<div id="loginScreen">.*?<!-- ════════════════════════════════════════════════════\s*APP CONTAINER', login_screen_new + '\n    <!-- ════════════════════════════════════════════════════\n         APP CONTAINER', content, flags=re.DOTALL)

with open('frontend/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated HTML successfully!')
