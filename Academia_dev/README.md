# 🎓 Academia — Dashboard Académico

Dashboard académico para estudiantes universitarios. Organiza tus materias, tareas, calificaciones, notas, horario y más, todo en un solo lugar.

## ✨ Funcionalidades

- 📊 **Resumen** — vista general de tu progreso académico
- 📚 **Materias** — gestión de cursos con colores e iconos
- ✅ **Tareas** — seguimiento de entregas con prioridades y subtareas
- 📅 **Calendario** — eventos y fechas importantes
- 🎯 **Calificaciones** — zonas configurables, cálculo automático
- 📝 **Notas** — editor rico con canvas de dibujo, adjuntos PDF e imágenes
- ⏱️ **Pomodoro** — temporizador con historial y metas
- 🧠 **Flashcards** — tarjetas de estudio
- 🌗 **Tema oscuro/claro**
- 📱 **Responsive** — funciona en móvil, tablet y escritorio

## 🛠️ Tecnologías

- HTML · CSS · JavaScript (vanilla)
- [PDF.js](https://mozilla.github.io/pdf.js/) — visualización de PDFs
- [Tesseract.js](https://tesseract.projectnaptha.com/) — OCR de imágenes
- [Netlify](https://netlify.com) — hosting
- `localStorage` — almacenamiento local (sin backend, por ahora)

## 🚀 Uso

1. Clona el repositorio
2. Abre `index.html` en tu navegador
3. O visita la versión en vivo: **[academia-dev.netlify.app]()**

No requiere instalación ni servidor.

## 📁 Estructura

```
ACADEMIA_DEV/
├── index.html          ← Estructura HTML
├── css/
│   └── style.css       ← Estilos + responsive
└── js/
    ├── app.js          ← Estado, páginas, overview
    ├── calificaciones.js
    ├── tasks.js
    ├── calendar.js
    ├── notes.js        ← Notas, canvas, OCR
    └── chrono.js       ← Pomodoro, PDF, focus mode
```

## 🤖 Desarrollo con IA

Este proyecto fue desarrollado íntegramente con asistencia de **Claude (Anthropic)** como herramienta de programación. Todas las decisiones de diseño, funcionalidad y arquitectura fueron definidas por el autor.

El uso de IA como herramienta de desarrollo es una práctica legítima y cada vez más común en la industria del software.

## 👤 Autor

**Josué Castro** — [@josueeliucastrososa-cmyk](https://github.com/josueeliucastrososa-cmyk)

## 📄 Licencia

[MIT License](LICENSE) — libre de usar, modificar y distribuir con atribución al autor original.

## 🗺️ Roadmap

- [ ] Login con Google/correo (Supabase)
- [ ] Base de datos en la nube (datos por usuario)
- [ ] PWA — instalable en Android/iOS
- [ ] APK nativo con Capacitor
- [ ] Dominio propio
