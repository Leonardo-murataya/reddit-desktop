import React, { useState, useEffect } from 'react';
import { Save, Bell, CheckCircle2, AlertTriangle, Loader2, Info, MessageSquare } from 'lucide-react';

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

export default function IntegrationsPanel({ settings, onSave }) {
  const [discordEnabled, setDiscordEnabled] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [countryPrefix, setCountryPrefix] = useState('521');
  const [localPhone, setLocalPhone] = useState('');
  const [whatsappApiKey, setWhatsappApiKey] = useState('');
  
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    const s = settings?.settings || settings;
    if (s) {
      setDiscordEnabled(s.discordEnabled ?? false);
      setDiscordWebhookUrl(s.discordWebhookUrl || '');
      setWhatsappEnabled(s.whatsappEnabled ?? false);
      setWhatsappApiKey(s.whatsappApiKey || '');
      
      const fullPhone = s.whatsappPhone || '';
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    
    const baseSettings = settings?.settings || settings || {};
    onSave({
      ...baseSettings,
      discordEnabled,
      discordWebhookUrl: discordWebhookUrl.trim(),
      whatsappEnabled,
      whatsappPhone: getFullWhatsappPhone(),
      whatsappApiKey: whatsappApiKey.trim()
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
      const data = await res.json();
      if (res.ok) {
        setTestResult('¡Notificación de prueba enviada con éxito!');
        setTimeout(() => setTestResult(''), 4000);
      } else {
        setError(data.error || 'Error al enviar la notificación de prueba.');
      }
    } catch (err) {
      setError('Error de conexión con el servidor local.');
    } finally {
      setIsTesting(false);
    }
  };

  const isTestDisabled = isTesting || (!discordEnabled && !whatsappEnabled) || (discordEnabled && !discordWebhookUrl.trim()) || (whatsappEnabled && (!localPhone.trim() || !whatsappApiKey.trim()));

  return (
    <div className="space-y-6 max-w-full">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
          <span>INTEGRACIONES & NOTIFICACIONES</span>
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Recibe avisos automáticos en tu móvil o servidor de Discord cuando los lotes de video finalicen o si ocurre algún error.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Formulario Principal (3/5) */}
        <div className="lg:col-span-3 space-y-6">
          <form onSubmit={handleSubmit} className="glass-panel rounded-3xl p-6 space-y-6 border border-white/5 bg-gradient-to-b from-[#101624] to-[#0a0e18]">
            
            {/* SECCIÓN 1: DISCORD WEBHOOK */}
            <div className="border border-white/5 bg-black/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#5865F2]/20 text-[#5865F2] rounded-xl">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>Discord Webhooks</span>
                      {discordEnabled && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-extrabold uppercase">
                          Activo
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-gray-400">Recibe embeds de estado en tu canal de Discord.</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={discordEnabled}
                    onChange={(e) => setDiscordEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                </label>
              </div>

              {discordEnabled && (
                <div className="space-y-1.5 pt-2 border-t border-white/5 animate-fadeIn">
                  <label className="block text-[10.5px] font-bold text-gray-400 uppercase">URL del Webhook de Discord</label>
                  <input
                    type="text"
                    value={discordWebhookUrl}
                    onChange={(e) => setDiscordWebhookUrl(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary font-mono"
                  />
                  <span className="text-[10px] text-gray-500 block leading-tight">
                    Copia la URL de Webhook desde los ajustes de integraciones de tu canal en Discord.
                  </span>
                </div>
              )}
            </div>

            {/* SECCIÓN 2: WHATSAPP (CALLMEBOT) */}
            <div className="border border-white/5 bg-black/20 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#25D366]/20 text-[#25D366] rounded-xl">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <span>WhatsApp (CallMeBot API)</span>
                      {whatsappEnabled && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-extrabold uppercase">
                          Activo
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-gray-400">Recibe mensajes de texto instantáneos en tu WhatsApp personal.</p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={whatsappEnabled}
                    onChange={(e) => setWhatsappEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                </label>
              </div>

              {whatsappEnabled && (
                <div className="space-y-3 pt-2 border-t border-white/5 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="block text-[10.5px] font-bold text-gray-400 uppercase">Prefijo de País</label>
                      <select
                        value={countryPrefix}
                        onChange={(e) => setCountryPrefix(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-brand-primary cursor-pointer font-medium"
                      >
                        {COUNTRY_PREFIXES.map((cp) => (
                          <option key={cp.value} value={cp.value}>
                            {cp.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10.5px] font-bold text-gray-400 uppercase">Número de Teléfono</label>
                      <input
                        type="text"
                        value={localPhone}
                        onChange={(e) => setLocalPhone(e.target.value)}
                        placeholder="ej. 3121234567"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-bold text-gray-400 uppercase">API Key de CallMeBot</label>
                    <input
                      type="password"
                      value={whatsappApiKey}
                      onChange={(e) => setWhatsappApiKey(e.target.value)}
                      placeholder="ej. 123456"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand-primary font-mono truncate"
                    />
                  </div>
                  <span className="text-[10px] text-gray-500 block leading-tight">
                    Envía notificaciones de WhatsApp gratuitas a tu teléfono mediante el servicio personal de CallMeBot.
                  </span>
                </div>
              )}
            </div>

            {/* Feedback Alerts */}
            {success && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl p-3.5 text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl p-3.5 text-xs flex items-center gap-2 animate-fadeIn">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {testResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl p-3.5 text-xs flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{testResult}</span>
              </div>
            )}

            {/* Acciones */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={handleTestWebhook}
                disabled={isTestDisabled}
                className="bg-black/40 hover:bg-black/60 text-white font-bold px-4 py-2.5 rounded-xl border border-white/10 hover:border-gray-500 cursor-pointer transition-all duration-200 text-xs flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
                <span>PROBAR NOTIFICACIÓN</span>
              </button>

              <button
                type="submit"
                className="bg-brand-primary hover:bg-brand-primary-hover text-white font-extrabold px-6 py-2.5 rounded-xl transition-all duration-200 text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-brand-primary/10 active:scale-95"
              >
                <Save className="w-3.5 h-3.5" />
                <span>GUARDAR AJUSTES</span>
              </button>
            </div>
          </form>
        </div>

        {/* Panel de Ayuda (2/5) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel rounded-3xl p-6 space-y-4 border border-white/5 bg-[#0e1320]">
            <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
              <Info className="w-4 h-4 text-brand-primary" />
              <span>¿Cómo configurar?</span>
            </h3>

            {/* Discord Guide */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-black text-white uppercase tracking-wider">1. Discord Webhooks</h4>
              <p className="text-[10.5px] text-gray-400 leading-relaxed">
                Ve al canal de texto de tu servidor de Discord donde deseas recibir los mensajes. Abre los ajustes del canal, haz click en <strong>Integraciones &rarr; Webhooks</strong>, crea uno nuevo y copia la URL de Webhook y pégala en el campo de la izquierda.
              </p>
            </div>

            {/* WhatsApp Guide */}
            <div className="space-y-1.5 pt-3 border-t border-white/5">
              <h4 className="text-[11px] font-black text-white uppercase tracking-wider">2. WhatsApp Bot (CallMeBot)</h4>
              <p className="text-[10.5px] text-gray-400 leading-relaxed">
                Para obtener tu API Key gratuita:
                <br />
                1. Agrega el número de CallMeBot a tus contactos de tu móvil (+34 644 20 22 28 o consulta la web oficial).
                <br />
                2. Envía el mensaje <code className="bg-black/50 px-1 py-0.5 rounded text-emerald-400 font-mono">I allow callmebot to send me messages</code> al bot por WhatsApp.
                <br />
                3. El bot te responderá con tu <strong>API Key</strong> única de 6 dígitos.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
