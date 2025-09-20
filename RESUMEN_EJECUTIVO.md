# EJECUTAR: Gestión de Ramas - Resumen Ejecutivo

## Situación Actual
El repositorio `asdrubalfuentes/cotizador` tiene dos ramas principales con contenido muy diferente:

- **Rama `main`**: Solo contiene el archivo LICENSE (1 archivo, 1 commit)
- **Rama `master`**: Contiene la aplicación completa (54 archivos, 14 commits)

## Objetivo
Según la solicitud: "elimina la rama main y deja solo la rama master, y después la renombras main"

## Acciones Requeridas

### 1. Eliminar la rama `main`
La rama actual `main` solo tiene el LICENSE y debe ser eliminada.

### 2. Renombrar `master` a `main`  
La rama `master` (que contiene la aplicación completa) debe convertirse en la nueva rama `main`.

## Métodos de Ejecución

### Opción A: Interfaz Web de GitHub (Más Fácil)
1. Ir a https://github.com/asdrubalfuentes/cotizador/branches
2. Eliminar la rama `main` (botón de basura)
3. Ir a Configuración del repositorio
4. Cambiar rama por defecto de `master` a `main` (GitHub ofrecerá renombrar)

### Opción B: GitHub CLI
```bash
gh api repos/asdrubalfuentes/cotizador/git/refs/heads/main -X DELETE
gh api repos/asdrubalfuentes/cotizador/branches/master/rename -f new_name=main -X POST
```

## Resultado Esperado
- ❌ Rama `main` (antigua) eliminada
- ✅ Rama `main` (nueva) con todo el contenido de la aplicación
- ✅ Rama `main` como rama por defecto
- ✅ Todas las características y commits preservados

## Archivos de Documentación Creados
- `BRANCH_MANAGEMENT_GUIDE.md` - Guía completa paso a paso
- `GITHUB_API_COMMANDS.md` - Comandos de API específicos
- `branch_management_demo.sh` - Script de demostración local

## ⚠️ Importante
- Esta operación es irreversible
- La rama `main` actual (solo LICENSE) se perderá
- La rama `master` (aplicación completa) se convertirá en la nueva `main`
- Es el comportamiento correcto según lo solicitado

## Próximos Pasos
El usuario debe ejecutar una de las opciones de eliminación/renombrado usando GitHub directamente, ya que este entorno no puede modificar ramas remotas.