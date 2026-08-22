# 🎥 reddit-generador: Generador Automático de Videos Virales de Reddit

reddit-generador es una plataforma web profesional y autocontenida diseñada para automatizar la creación de videos virales en formatos vertical (9:16) y horizontal (16:9) ideales para redes sociales como **TikTok, Facebook Reels, YouTube Shorts, e Instagram**.

Combina el poder de la Inteligencia Artificial de Google Gemini, síntesis de voz en alta definición, renderizado estético de tarjetas de publicaciones de Reddit y compilación de video ultra rápida optimizada por hardware (GPU).

---

## 🚀 Características Clave

1. **Generación Creativa de Historias (IA):**
   - Redacción automatizada de guiones dramáticos con micro-cliffhangers de retención basados en ideas simples.
   - Integración directa con los modelos de última generación de Google Gemini (**Gemini 3.5 Flash** predeterminado).
2. **Locución Narrativa de Alta Calidad:**
   - Síntesis de voz en tiempo real con voces naturales en español neutro (masculino/femenino) mediante **Edge-TTS** local.
   - Ajuste fino de la velocidad de locución para maximizar la retención del espectador (narradores a +15% o +20%).

3. **Subtítulos Sincronizados Enriquecidos (Tipo Capcut):**
   - Generación automática de subtítulos portables en formato `.ass`.
   - **Animaciones Avanzadas en Vivo:**
     - **Borde Emergente II (Capcut Style):** Caja de color morado sólido plano que resalta las palabras en sincronía exacta sin alterar el tamaño ni la escala del bloque de texto.
     - **Active Highlight:** Iluminación en amarillo de la palabra activa sin zoom.
     - **TikTok Pop / Bounce Pop:** Palabra a la vez con efectos de escalado suaves.
   - Soporte integrado de fuentes locales (ej. **Bangers**, Arial Bold) para uso portátil sin necesidad de instalación global en el sistema.

4. **Compilación de Video Profesional con FFmpeg:**
   - Escalado a Full HD (1080p) con transiciones dinámicas (slide, fade, zoom) en la tarjeta del post de Reddit.
   - **Aceleración por Hardware (GPU) de Calidad Master:** Autodetecta y utiliza la GPU del sistema (NVIDIA NVENC, AMD AMF, Intel QSV) aplicando configuraciones de bitrate inteligente (**VBR de 6Mbps a 12Mbps**) para garantizar videos completamente nítidos y sin pixelación.

---

## 🛠️ Requisitos Previos

Antes de iniciar la aplicación, asegúrate de tener instalado en tu sistema:

1. **[Node.js](https://nodejs.org/)** (Versión 18 o superior recomendada).
2. **[FFmpeg](https://ffmpeg.org/)** (Requisito mandatorio para la compilación y procesamiento de video).

### 📦 Guía de Instalación de FFmpeg en Windows

Para que la aplicación pueda hacer uso de FFmpeg, este debe estar instalado y agregado a las variables de entorno de tu sistema (PATH). Sigue estos sencillos pasos:

1. **Descargar los ejecutables:**
   * Entra a la página de descargas oficial de [FFmpeg](https://ffmpeg.org/download.html) o ve directamente a [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) (el proveedor oficial de compilaciones para Windows).
   * Descarga el archivo zip de la compilación **ffmpeg-release-essentials.zip** o el instalador git-full.
2. **Extraer el contenido:**
   * Descomprime el archivo zip en una ubicación permanente y de fácil acceso en tu disco local, por ejemplo en `C:\ffmpeg`.
   * Verifica que dentro de esa carpeta exista una subcarpeta llamada `bin`, la cual debe contener los ejecutivos de consola `ffmpeg.exe`, `ffplay.exe` y `ffprobe.exe`.
3. **Agregar FFmpeg a las Variables de Entorno (PATH):**
   * En la barra de búsqueda de Windows (menú Inicio), escribe **"Variables de entorno"** y selecciona la opción **"Editar las variables de entorno del sistema"**.
   * Se abrirá una ventana. Haz clic en el botón **"Variables de entorno..."** ubicado en la esquina inferior derecha.
   * En la sección **"Variables de usuario"** (o **"Variables del sistema"** para que aplique de manera global), busca la variable llamada **`Path`** y haz doble clic sobre ella (o selecciónala y haz clic en *Editar*).
   * En la ventana que se abre, haz clic en el botón **"Nuevo"** de la parte derecha, y escribe o pega la ruta absoluta hacia la carpeta `bin` de tu FFmpeg (por ejemplo: `C:\ffmpeg\bin`).
   * Haz clic en **Aceptar** en todas las ventanas abiertas para guardar de manera definitiva la configuración.
4. **Verificar la instalación:**
   * Cierra las terminales de comandos que tengas abiertas.
   * Abre una nueva ventana de la terminal de comandos (CMD o PowerShell).
   * Ejecuta el siguiente comando para validar que Windows reconozca el programa globalmente:
     ```bash
     ffmpeg -version
     ```
   * Si todo es correcto, la consola imprimirá la información de versión de tu FFmpeg en lugar de un error.

---

## 💻 Instalación y Puesta en Marcha

1. **Instalar Dependencias:**
   Ejecuta en la raíz del proyecto para instalar las dependencias del servidor y de la interfaz:
   ```bash
   npm install
   npm install --prefix frontend
   ```

2. **Ejecutar en Modo Escritorio (Tauri Desktop App):**
   Inicia la aplicación de escritorio con recarga en vivo (Hot-Reload) de frontend y backend:
   ```bash
   npm run tauri:dev
   ```

3. **Compilar el Ejecutable `.exe` de Windows:**
   Para generar el instalador y el ejecutable nativo optimizado para producción:
   ```bash
   npm run tauri:build
   ```
   El ejecutable `.exe` y el instalador `.msi` se generarán automáticamente en la carpeta:
   `src-tauri/target/release/bundle/`

4. **Modo Web Clásico (Opcional):**
   Si prefieres ejecutarlo en el navegador web local:
   ```bash
   npm run dev
   ```
   Y abrir en tu navegador `http://localhost:3000`.

---

## ⚙️ Cómo Funciona la Aplicación (Guía de Uso)

### Paso 1: Configurar la API Key de Gemini

Ve a la sección **Ajustes** en la barra lateral del panel e introduce tu clave de API de Google Gemini. Selecciona tu perfil y guarda la configuración.

> [!TIP]
> **Optimización de Prompts**: Para que Gemini genere historias con un rendimiento óptimo de retención y 100% compatibles con el programa, lee nuestra [Guía de Optimización de System Prompts](file:///C:/Users/leonardoo/Desktop/redit/DOCUMENTACION_PROMPT.md). Allí encontrarás plantillas listas para copiar y las reglas del formato JSON que el motor de la plataforma requiere de forma obligatoria.

### Paso 2: Crear o Editar una Plantilla

En la pestaña de **Plantillas de Video**:

- Asigna la voz de tu narrador o narradora predeterminada.
- Ajusta la tipografía de los subtítulos. Para la fuente Bangers u otras personalizadas, selecciona la escala y verás la previsualización interactiva de inmediato.
- El **Tamaño de Fuente 100** representa ahora la escala estándar recomendada para evitar desbordamientos.
- **Previa en Vivo:** Usa el reproductor dinámico para simular el comportamiento de las animaciones en tiempo real y corregir el posicionamiento en los ejes X e Y antes de renderizar.

### Paso 3: Generación del Video Final

Ve al panel principal, ingresa una idea sencilla (ej: _"Mi madre me quería encerrar en un manicomio para robar mi herencia"_), selecciona tu plantilla favorita y haz clic en **Generar Video**.

La IA redactará la historia, el sintetizador de voz creará los audios, se generarán los subtítulos alineados palabra por palabra en la línea de tiempo y **FFmpeg compilará automáticamente el video final** en tu escritorio usando la aceleración de tu tarjeta gráfica para completarlo en segundos.

---

## 📂 Estructura del Proyecto

- `/services/ffmpeg.js`: El cerebro de renderizado. Controla los argumentos del filtro complejo de FFmpeg y las velocidades/presets de las GPUs.
- `/services/subtitles.js`: Genera los estilos de la tipografía y sincronización del archivo ASS.
- `/services/gemini.js`: Conexión de IA para la redacción de guiones con fallback de sobrecarga.
- `/frontend`: Panel de administración web interactivo en React.
- `/fonts`: Carpeta para tipografías TTF personalizadas.

---

## 📄 Licencia

Este proyecto es privado. Todos los derechos reservados.
