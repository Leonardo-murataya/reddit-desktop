import React, { useState, useEffect } from 'react';
import { Save, Bell, CheckCircle2, AlertTriangle, Loader2, Info, MessageSquare, Shield, HelpCircle } from 'lucide-react';

const COUNTRY_PREFIXES = [
  { value: '521', label: '🇲🇽 México Celular (+52 1)' },
  { value: '52', label: '🇲🇽 México Fijo (+52)' },
  { value: '34', label: '🇪🇸 España (+34)' },
  { value: '57', label: '🇨🇴 Colombia (+57)' },
  { value: '549', label: '🇦🇷 Argentina Celular (+54 9)' },
  { value: '56', label: '🇨🇱 Chile (+56)' },
  { value: '51', label: '🇵🇪 Perú (+51)' },
  { value: '593', label: '🇪🇨 Ecuador (+593)' },
  { value: '58', label: '🇻🇪 Venezuela (+58)' },
  { value: '1', label: '🇺🇸 EE.UU. / CA (+1)' },
  { value: '', label: 'Otro (Ingresa el código completo)' }
];

export default function IntegrationsPanel({ settings, onSave, onCheckUpdate }) {
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [countryPrefix, setCountryPrefix] = useState('521');
  const [localPhone, setLocalPhone] = useState('');
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  const [githubRepo, setGithubRepo] = useState('Leonardo-murataya/reddit-generador');
  const [githubToken, setGithubToken] = useState('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatusMsg, setUpdateStatusMsg] = useState('');
  
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    if (settings) {
      setDiscordEnabled(settings.discordEnabled ?? false);
      setDiscordWebhookUrl(settings.discordWebhookUrl || '');
      setWhatsappEnabled(settings.whatsappEnabled ?? false);
      setWhatsappApiKey(settings.whatsappApiKey || '');
      setGithubRepo(settings.githubRepo || 'Leonardo-murataya/reddit-generador');
      setGithubToken(settings.githubToken || '');
      
      const fullPhone = settings.whatsappPhone || '';
      const prefixes = ['521', '52', '34', '57', '549', '56', '51', '593', '58', '1'];
      let foundPrefix = '521';
      let foundLocal = fullPhone;
      
      for (const pref of prefixes) {
        if (fullPhone.startsWith(pref)) {
          foundPrefix = pref;
          foundLocal = fullPhone.slice(pref.length);
          break;
        }
      }
      setCountryPrefix(foundPrefix);
      setLocalPhone(foundLocal);
    }
  }, [settings]);

  const getFullWhatsappPhone = () => {
    const cleanLocal = localPhone.replace(/[+\s\-()]/g, '');
    return countryPrefix + cleanLocal;
  };

  const handleCheckUpdatesManual = async () => {
    setIsCheckingUpdate(true);
    setUpdateStatusMsg('');
    setError('');
    try {
      const res = await fetch('/api/updater/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubRepo,
          githubToken
        })
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.hasUpdate) {
        setUpdateStatusMsg(`¡Nueva versión v${data.latestVersion} disponible!`);
        if (onCheckUpdate) {
          onCheckUpdate(data);
        }
      } else {
        setUpdateStatusMsg(`Tu versión (v${data.currentVersion}) está actualizada.`);
      }
    } catch (err) {
      setError('Error al consultar el servicio de actualizaciones.');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    
    onSave({
      ...settings,
      discordEnabled,
      discordWebhookUrl,
      whatsappEnabled,
      whatsappPhone: getFullWhatsappPhone(),
      whatsappApiKey,
      githubRepo,
      githubToken
    });
    
    setSuccess('Configuración de integraciones guardada exitosamente.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleTestWebhook = async () => {
    setIsTesting(true);
    setTestResult('');
    setError('');
    try {
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          discordEnabled,
          discordWebhookUrl,
          whatsappEnabled,
          whatsappPhone: getFullWhatsappPhone(),
          whatsappApiKey
        })
      });
      
      let errorMsg = 'Error al enviar la notificación de prueba.';
      let data = null;
      try {
        data = await res.json();
      } catch (jsonErr) {
        setError(`Error del servidor (${res.status}): Asegúrate de que el servidor esté en ejecución y los datos sean válidos.`);
        setIsTesting(false);
        return;
      }

      if (!res.ok) {
        setError(data.error || errorMsg);
      } else {
        setTestResult('¡Notificación de prueba enviada con éxito! Revisa tus canales configurados activos.');
        setTimeout(() => setTestResult(''), 5000);
      }
    } catch (err) {
      setError('Error de conexión: No se pudo comunicar con el servidor backend.');
    } finally {
      setIsTesting(false);
    }
  };

  const isTestDisabled = isTesting || 
    (!discordEnabled && !whatsappEnabled) || 
    (discordEnabled && !discordWebhookUrl.trim()) || 
    (whatsappEnabled && (!localPhone.trim() || !whatsappApiKey.trim()));

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div>
        <h2 className="text-2xl font-black text-white">INTEGRACIONES Y NOTIFICACIONES</h2>
        <p className="text-xs text-gray-400">Recibe notificaciones automáticas en tu celular cuando finalicen tus colas de renderizado de videos en segundo plano.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Formulario Principal (3/5) */}
        <div className="lg:col-span-3 space-y-6">
          <form onSubmit={handleSubmit} className="glass-panel rounded-2xl p-6 space-y-6">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
              <Bell className="w-4 h-4 text-brand-primary" />
              <span>Configuración de Mensajería</span>
            </h3>

            {/* Discord Webhook */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border-dark/30 pb-2">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${discordEnabled ? 'bg-indigo-500 shadow-[0_0_8px_#6366f1]' : 'bg-gray-600'}`}></span>
                  <span>Notificaciones por Discord</span>
                </h4>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discordEnabled}
                    onChange={(e) => setDiscordEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-black/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary peer-checked:after:bg-white peer-checked:after:border-white"></div>
                  <span className="ml-2 text-[10px] font-bold text-gray-400 uppercase select-none w-14">{discordEnabled ? 'Activado' : 'Desactivado'}</span>
                </label>
              </div>

              {discordEnabled && (
                <div className="space-y-2 animate-fadeIn">
                  <label className="block text-xs font-bold text-gray-400 uppercase">Webhook de Discord (URL)</label>
                  <input
                    type="text"
                    value={discordWebhookUrl}
                    onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full bg-black/40 border border-border-dark rounded-xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary font-mono truncate"
                  />
                  <span className="text-[10px] text-gray-500 block leading-tight">
                    Los mensajes de estado de tus videos se enviarán de forma inmediata al canal de Discord enlazado por esta URL.
                  </span>
                </div>
              )}
            </div>

            <div className="border-t border-border-dark/60 my-4"></div>

            {/* WhatsApp Config (CallMeBot) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border-dark/30 pb-2">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${whatsappEnabled ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-gray-600'}`}></span>
                  <span>Notificaciones por WhatsApp</span>
                </h4>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whatsappEnabled}
                    onChange={(e) => setWhatsappEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-black/60 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary peer-checked:after:bg-white peer-checked:after:border-white"></div>
                  <span className="ml-2 text-[10px] font-bold text-gray-400 uppercase select-none w-14">{whatsappEnabled ? 'Activado' : 'Desactivado'}</span>
                </label>
              </div>

              {whatsappEnabled && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* WhatsApp Phone */}
                    <div className="space-y-1.5">
                      <label className="block text-[10.5px] font-bold text-gray-400 uppercase">Número de Celular</label>
                      <div className="flex gap-2">
                        <select
                          value={countryPrefix}
                          onChange={(e) => setCountryPrefix(e.target.value)}
                          className="bg-black/40 border border-border-dark rounded-xl px-2.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary cursor-pointer w-36 font-semibold"
                        >
                          {COUNTRY_PREFIXES.map((prefix) => (
                            <option key={prefix.value} value={prefix.value} className="bg-neutral-900 text-white">
                              {prefix.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={localPhone}
                          onChange={(e) => setLocalPhone(e.target.value)}
                          placeholder="Fijo o móvil (10 dígitos)"
                          className="flex-1 bg-black/40 border border-border-dark rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary font-mono"
                        />
                      </div>
                    </div>

                    {/* WhatsApp API Key */}
                    <div className="space-y-1.5">
                      <label className="block text-[10.5px] font-bold text-gray-400 uppercase">CallMeBot API Key</label>
                      <input
                        type="text"
                        value={whatsappApiKey}
                        onChange={(e) => setWhatsappApiKey(e.target.value)}
                        placeholder="ej. 123456"
                        className="w-full bg-black/40 border border-border-dark rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary font-mono truncate"
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-500 block leading-tight">
                    Envía notificaciones de WhatsApp gratuitas a tu teléfono mediante el servicio personal de CallMeBot.
                  </span>
                </div>
              )}
            </div>

            {/* SECCIÓN 3: ACTUALIZACIONES DE GITHUB (REPOSITORIO PRIVADO / PÚBLICO) */}
            <div className="border border-purple-500/20 bg-purple-950/10 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>Actualizaciones de la Aplicación (GitHub)</span>
                      <span className="text-[10px] bg-purple-500/30 text-purple-300 px-2 py-0.5 rounded-full font-extrabold uppercase">
                        Opcional
                      </span>
                    </h3>
                    <p className="text-[11px] text-gray-400">Verifica nuevas versiones y lanzamientos de forma automática o manual.</p>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-purple-500/20 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* GitHub Repo */}
                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-bold text-gray-400 uppercase">Repositorio de GitHub</label>
                    <input
                      type="text"
                      value={githubRepo}
                      onChange={(e) => setGithubRepo(e.target.value)}
                      placeholder="ej. usuario/reddit-desktop"
                      className="w-full bg-black/40 border border-border-dark rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 font-mono"
                    />
                    <span className="text-[9.5px] text-gray-500 block">Formato: <code>propietario/repositorio</code></span>
                  </div>

                  {/* GitHub Read-Only Token */}
                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-bold text-gray-400 uppercase">Token de Solo Lectura (Opcional para Repos Privados)</label>
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_... o github_pat_..."
                      className="w-full bg-black/40 border border-border-dark rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 font-mono"
                    />
                    <span className="text-[9.5px] text-gray-500 block">Solo requiere permiso <code>Contents: Read</code>. No requiere permisos de escritura.</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={handleCheckUpdatesManual}
                    disabled={isCheckingUpdate}
                    className="bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 hover:text-white font-bold px-4 py-2 rounded-xl border border-purple-500/30 cursor-pointer transition-all text-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isCheckingUpdate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                    <span>BUSCAR ACTUALIZACIONES AHORA</span>
                  </button>

                  {updateStatusMsg && (
                    <span className="text-xs font-semibold text-purple-300">
                      {updateStatusMsg}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Feedback Alerts */}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3.5 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3.5 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {testResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3.5 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{testResult}</span>
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-border-dark">
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={isTestDisabled}
                className="bg-black/40 hover:bg-black/60 text-white font-bold px-4 py-2.5 rounded-xl border border-border-dark hover:border-gray-500 cursor-pointer transition-all duration-200 text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                <span>PROBAR NOTIFICACIÓN</span>
              </button>

              <button
                type="submit"
                className="bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold px-6 py-2.5 rounded-xl transition-all duration-200 text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-brand-primary/10"
              >
                <Save className="w-3.5 h-3.5" />
                <span>GUARDAR AJUSTES</span>
              </button>
            </div>
          </form>
        </div>

        {/* Panel de Ayuda (2/5) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-2xl p-6 space-y-4">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-border-dark pb-2">
              <Info className="w-4 h-4 text-brand-primary" />
              <span>¿Cómo configurar?</span>
            </h3>

            {/* Discord Guide */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-black text-white uppercase tracking-wider font-bold">1. Discord Webhooks</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Ve al canal de texto de tu servidor de Discord donde deseas recibir los mensajes. Abre los ajustes del canal, haz click en <strong>Integraciones &rarr; Webhooks</strong>, crea uno nuevo y copia la URL de Webhook y pégala en el campo de la izquierda.
              </p>
            </div>

            {/* WhatsApp Guide */}
            <div className="space-y-1.5 pt-2 border-t border-border-dark/30">
              <h4 className="text-[11px] font-black text-white uppercase tracking-wider font-bold">2. WhatsApp Bot (CallMeBot)</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Para obtener tu API Key gratuita:
                <br />
                1. Agrega el número de CallMeBot a tus contactos de tu móvil (+34 644 20 22 28 o consulta la web oficial).
                <br />
                2. Envía el mensaje <code>I allow callmebot to send me messages</code> al bot por WhatsApp.
                <br />
                3. El bot te responderá con tu <strong>API Key</strong> única de 6 dígitos.
              </p>
            </div>

            {/* GitHub Token Guide */}
            <div className="space-y-1.5 pt-2 border-t border-border-dark/30">
              <h4 className="text-[11px] font-black text-white uppercase tracking-wider font-bold">3. Token de GitHub (Solo Lectura)</h4>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Si tu repositorio es <strong>privado</strong>, necesitas un Token con permiso de lectura para consultar y descargar releases:
                <br />
                1. Ve a GitHub &rarr; Settings &rarr; Developer Settings &rarr; <strong>Personal Access Tokens</strong> &rarr; <strong>Fine-grained tokens</strong>.
                <br />
                2. Selecciona tu repositorio y asigna únicamente el permiso: <strong>Contents: Read-only</strong>.
                <br />
                3. Pega el token generado en el campo de la izquierda y guarda los ajustes.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
