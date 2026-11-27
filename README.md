# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## CI/CD con GitHub Actions y SSH

El workflow `.github/workflows/deploy.yml` está preparado para este repositorio independiente: sus archivos deben estar en la raíz del repo, sin otra carpeta `frontend/` o `backend/` envolviéndolos.

- Pull request hacia `main`: verifica el proyecto, sin acceder al servidor.
- Push a `main`: verifica, empaqueta y despliega por SSH si todo pasa.
- También se puede iniciar desde Actions > Run workflow en `main`.
- Los despliegues usan el entorno GitHub `production` y versiones separadas. `current` apunta a la versión activa; no se borran las versiones anteriores.
- No se necesitan Git, Node, npm ni Composer en el servidor. Sí se necesitan Bash, tar, OpenSSH/SFTP y, para Laravel, PHP compatible y sus extensiones.

### Configurar acceso SSH una vez

En Git Bash de tu equipo, genera una clave exclusiva para Actions (sin contraseña interactiva):

```bash
mkdir -p ~/.ssh
ssh-keygen -t ed25519 -C github-actions-sistema-web -f ~/.ssh/sistema-web-actions -N ""
cat ~/.ssh/sistema-web-actions.pub
```

En Termius, agrega **la clave pública** como una línea a `~/.ssh/authorized_keys` del usuario `grupo18sa`:

```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
touch ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Edita `authorized_keys` para agregarla conservando las claves existentes. La clave privada se configura solo como secret de GitHub; no se sube al repositorio ni al chat.

Obtén las claves públicas del servidor desde Git Bash:

```bash
ssh-keyscan -p 22 www.tecnoweb.org.bo
```

Comprueba su huella con el ingeniero o la conexión SSH ya verificada antes de guardarlas. Si usa otro puerto, cambia el 22. La verificación SSH está activada en el workflow.

### Secrets en cada repositorio

En GitHub > Settings > Secrets and variables > Actions > Secrets, agrega los mismos secretos a ambos repositorios:

| Secret | Valor |
| --- | --- |
| `SSH_HOST` | `www.tecnoweb.org.bo` |
| `SSH_PORT` | `22` o el puerto asignado |
| `SSH_USER` | `grupo18sa` |
| `SSH_PRIVATE_KEY` | Contenido completo de la clave privada `sistema-web-actions` |
| `SSH_KNOWN_HOSTS` | Líneas verificadas de las claves públicas del servidor, en formato known_hosts |

El acceso a Termius por contraseña no configura automáticamente estas claves. No se usa la contraseña FTP como secret del workflow.

Crea también el entorno `production` en Settings > Environments. Puedes usar secrets de repositorio o del entorno `production`. El trabajo de despliegue necesita acceso a ellos.

### Variables del frontend

En Settings > Secrets and variables > Actions > Variables:

| Variable | Valor |
| --- | --- |
| `DEPLOY_PATH` | `/home/grupo18sa/proyecto2/frontend` (valor por defecto) |
| `VITE_API_URL` | URL pública completa del backend, incluyendo `/api`; por ejemplo `https://DOMINIO_API/api` |
| `VITE_BASE_PATH` | `/inf513/grupo18sa/proyecto2/` (valor por defecto para la entrada pública del sistema) |

Si el servidor ya dirige `/api` hacia Laravel en el mismo dominio, `VITE_API_URL=/api` funciona. El proxy de Vite solo sirve durante desarrollo: no existe en `dist`. Nunca uses `localhost:8000` como API de producción. Las variables `VITE_*` son públicas; no pongas contraseñas ni secretos allí.

`VITE_API_URL` y `VITE_BASE_PATH` se leen en el trabajo de compilación: configúralas como variables del **repositorio**, no solo del entorno production.

GitHub ejecuta `npm ci` y `npm run build`, y envía solo el contenido compilado de `dist`. La configuración local `.env` no se envía al servidor.

### Directorio web

Las versiones compiladas permanecen en:

```text
/home/grupo18sa/proyecto2/frontend/current
```

El despliegue crea estos enlaces en `/home/grupo18sa/proyecto2`, sin reemplazar archivos ajenos:

```text
index.html -> frontend/current/index.html
assets     -> frontend/current/assets
```

Así el servidor institucional puede abrir el sistema directamente en `https://www.tecnoweb.org.bo/inf513/grupo18sa/proyecto2/`, conservando esa URL. Los enlaces siguen la versión activa de `current`. Si ya tienes una variable de repositorio `VITE_BASE_PATH`, actualízala a `/inf513/grupo18sa/proyecto2/`, porque reemplaza el valor por defecto. El servidor debe permitir estos enlaces simbólicos, como ya lo hace para `frontend/current`.

Esta aplicación navega entre secciones sin rutas del navegador. Si incorporas rutas como `/login`, también necesitarás configurar su reescritura a `index.html`. La publicación de la API se configura por separado: los enlaces anteriores no publican Laravel.

No ejecutes `npm run dev` en producción. El servidor entrega los archivos estáticos compilados.
