# 🎬 Reddit Video Generator Desktop (Studio Suite v2.0)

**Reddit Video Generator Desktop** es una aplicación nativa de escritorio para Windows (construida con **Tauri v2 + Rust + React**) diseñada para automatizar la creación masiva de videos virales de alta retención para **TikTok, YouTube Shorts, Instagram Reels y Facebook Reels**.

Combina Inteligencia Artificial (**Google Gemini**), síntesis de voz neuronal en alta definición (**Edge-TTS**), renderizado estético de publicaciones y comentarios de Reddit, subtítulos dinámicos estilo Capcut sincronizados palabra por palabra y aceleración gráfica por hardware (**GPU NVENC / AMF / QSV**).

---

## ⚡ Características Principales

1. **🤖 Generación Inteligente de Guiones (IA):**
   - Redacción automatizada de guiones dramáticos con micro-cliffhangers de retención basados en ideas simples o palabras clave.
   - Integración directa con los modelos de Google Gemini (**Gemini 3.5 Flash**, Gemini 2.5 Flash, etc.).

2. **🎙️ Locución Neuronal en Alta Definición:**
   - Síntesis de voz en tiempo real con voces naturales en español neutro (masculino/femenino) mediante **Edge-TTS** local.
   - Ajuste fino de la velocidad de locución para maximizar la retención del espectador (narradores a +15% o +20%).

3. **💬 Subtítulos Sincronizados Enriquecidos (Tipo Capcut):**
   - Generación automática de subtítulos portables en formato `.ass`.
   - **Animaciones en Vivo:**
     - **Borde Emergente II (Capcut Style):** Caja de color morado sólido plano que resalta las palabras en sincronía exacta sin alterar el tamaño ni la escala del bloque de texto.
     - **Active Highlight:** Iluminación en amarillo de la palabra activa.
     - **TikTok Pop / Bounce Pop:** Palabra a la vez con efectos de escalado suaves.
   - Soporte integrado de fuentes locales (ej. **Bangers**, Arial Bold) para uso portátil sin necesidad de instalación global en el sistema.

4. **🚀 Renderizado Ultra Rápido por Hardware (GPU Master Quality):**
   - Autodetecta y utiliza la GPU del sistema (NVIDIA NVENC, AMD AMF, Intel QSV) aplicando configuraciones de bitrate inteligente (**VBR de 6Mbps a 12Mbps**) para garantizar videos completamente nítidos y sin pixelación a 1080p vertical (9:16).

5. **📋 Modo de Pegado Masivo & Cadenas de Perfiles:**
   - **Pegado Masivo:** Pega 5, 10, 20 o más ideas separadas por renglón y genera toda la cola con 1 solo clic.
   - **Cadenas de Perfiles:** Automatiza tandas secuenciales con diferentes voces, plantillas y canales en un solo lote continuo.

6. **🏝️ Dock Flotante de Progreso (Dynamic Island):**
   - Sigue navegando entre plantillas, perfiles y ajustes mientras el lote se renderiza en segundo plano gracias al mini-player flotante con estado en vivo y controles de pausa.

7. **🔔 Notificaciones Automáticas:**
   - Envío de alertas y resúmenes de finalización de lote directamente a tu **Discord** (Webhooks) o **WhatsApp** personal (CallMeBot).

---

## 📖 Guía de Uso Rápido

### 1. Configurar tu Clave de API de Gemini
* Ve a la sección **Perfiles de IA** o **Ajustes** e ingresa tu API Key gratuita de Google Gemini.
* Puedes crear múltiples perfiles con distintos system prompts (Historias de Terror, Chismes, Curiosidades, etc.).

### 2. Personalizar o Elegir una Plantilla de Video
* En **Plantillas de Video** puedes ajustar el tipo de subtítulo, tamaño de fuente, posición en pantalla, estilo de tarjeta de Reddit y voz del narrador.
* Usa el reproductor interactivo en vivo para previsualizar los subtítulos antes de renderizar.

### 3. Iniciar la Producción
* En el **Panel de Control**, escribe una idea sencilla o activa el **Pegado Masivo** para introducir múltiples guiones a la vez.
* Haz clic en **Comenzar Generación de Videos**.
* La aplicación procesará los videos en segundo plano con tu GPU y los exportará listos para publicar en tu carpeta configurada.

---

## 📂 Estructura del Proyecto

* `/src-tauri`: Núcleo de la aplicación nativa en Rust con Tauri v2 (gestión de ventana, ciclo de vida del backend y empaquetado del instalador `.exe`).
* `/frontend`: Interfaz gráfica moderna en React, Tailwind CSS y Lucide Icons.
* `/services/ffmpeg.js`: Motor de renderizado y aceleración de video por hardware.
* `/services/subtitles.js`: Generador y sincronizador de subtítulos dinámicos `.ass`.
* `/services/tts.js`: Síntesis de voz neuronal local con Edge-TTS.
* `/services/gemini.js`: Conexión de IA para redacción de historias.
* `/fonts`: Tipografías TTF integradas.

---

## 📄 Licencia

Este proyecto es privado y de uso exclusivo. Todos los derechos reservados.
