# Control de Pedidos - TODO

## Base de Datos
- [x] Diseñar esquema de tablas (usuarios, pedidos, clientes, productos, inventario, pagos)
- [x] Crear migraciones SQL
- [x] Ejecutar migraciones en base de datos

## Backend (API tRPC)
- [x] Crear procedimientos para gestión de usuarios y autenticación
- [x] Crear procedimientos para gestión de pedidos (CRUD)
- [x] Crear procedimientos para gestión de clientes
- [x] Crear procedimientos para gestión de inventario
- [x] Crear procedimientos para gestión de pagos
- [x] Crear procedimientos para rastreo GPS
- [ ] Implementar notificaciones al administrador
- [x] Escribir tests unitarios (vitest)

## Frontend - Estructura General
- [x] Configurar tema y estilos globales (Tailwind + shadcn/ui)
- [x] Crear layout principal con navegación
- [x] Implementar autenticación y login
- [x] Crear componentes reutilizables

## Frontend - Dashboard
- [x] Crear página de Dashboard con estadísticas
- [x] Mostrar pedidos activos, completados, pendientes
- [x] Mostrar métricas de inventario
- [x] Mostrar alertas de stock bajo

## Frontend - Gestión de Pedidos
- [x] Crear página de listado de pedidos
- [x] Crear formulario para crear pedido
- [ ] Crear formulario para editar pedido
- [ ] Implementar búsqueda y filtros
- [x] Mostrar detalles del pedido

## Frontend - Gestión de Inventario
- [x] Crear página de inventario
- [x] Mostrar productos (Leche, Botellas, Sabores)
- [x] Implementar alertas de stock bajo
- [ ] Crear formulario para actualizar inventario

## Frontend - Gestión de Pagos
- [x] Crear página de pagos (integrada en detalles de pedido)
- [x] Mostrar métodos de pago (QR, Efectivo, Transferencia)
- [x] Crear formulario para registrar pago
- [x] Mostrar estado de pago

## Frontend - Rastreo GPS
- [x] Integrar rastreo GPS en tiempo real
- [x] Mostrar ubicación actual del repartidor
- [x] Mostrar ruta hacia el cliente (Google Maps)
- [x] Actualizar ubicación en tiempo real

## Frontend - Contacto WhatsApp
- [x] Implementar botón de contacto por WhatsApp
- [x] Integrar número de cliente
- [x] Generar mensaje predefinido

## Frontend - Optimización Móvil
- [x] Verificar diseño responsive
- [x] Optimizar para pantallas pequeñas
- [x] Implementar navegación táctil
- [ ] Pruebas en dispositivos Android

## Notificaciones
- [ ] Configurar sistema de notificaciones
- [ ] Notificar al administrador sobre pedidos completados
- [ ] Notificar cambios de estado

## Pruebas y Ajustes
- [ ] Pruebas funcionales
- [ ] Pruebas de rendimiento
- [ ] Ajustes finales
- [ ] Documentación


## Mejoras Solicitadas
- [x] Agregar menú hamburguesa en esquina superior izquierda
- [x] Agregar campo de nombre del cliente en formulario de crear pedido
- [x] Guardar nombre del cliente en base de datos
- [x] Permitir que el sistema reconozca el nombre del cliente

## Mejoras Adicionales
- [x] Agregar campo de fecha de entrega en formulario de crear pedido
- [x] Agregar campo de hora de entrega en formulario de crear pedido
- [x] Guardar fecha y hora en base de datos
- [ ] Mostrar fecha y hora en detalles del pedido

## Formato de Moneda
- [x] Cambiar formato de precios a pesos bolivianos (Bs.)
- [x] Usar punto como separador de centavos
- [x] Actualizar visualización en formulario de crear pedido
- [ ] Actualizar visualización en detalles del pedido
- [ ] Actualizar visualización en listado de pedidos
- [ ] Actualizar visualización en inventario


## Sistema de Autenticación Tradicional
- [x] Crear tabla de usuarios con contraseña hasheada
- [x] Implementar página de login con usuario y contraseña
- [x] Crear API de login y logout
- [x] Implementar gestión de sesiones
- [ ] Crear página de registro de usuarios (admin)
- [x] Agregar validación de contraseña
- [ ] Agregar recuperación de contraseña olvidada


## Gestión de Repartidores
- [x] Crear API para listar repartidores
- [x] Crear API para crear repartidor
- [x] Crear API para editar repartidor
- [x] Crear API para eliminar repartidor
- [x] Crear página de gestión de repartidores
- [x] Agregar ruta de repartidores en el menú
- [x] Agregar validación de datos


## Bugs Reportados
- [x] Aplicación no muestra contenido después de login exitoso (RESUELTO)


## Inventarios Mejorados
- [x] Crear categorías de inventario (Productos Terminados vs Insumos)
- [x] Agregar productos terminados: Kéfir Coco, Kéfir Frutilla, Kéfir Vainilla
- [x] Agregar insumos: Botellas, Etiquetas, Tapas, Leche
- [x] Crear historial de movimientos de inventario
- [x] Implementar alertas de stock bajo
- [x] Crear interfaz separada para cada tipo de inventario
- [x] Agregar funcionalidad de entrada/salida de inventario


## Agregar Productos con Imagen
- [x] Crear diálogo para agregar nuevo producto
- [x] Agregar campo de imagen del producto
- [ ] Implementar carga de imagen a S3
- [x] Mostrar preview de imagen
- [x] Guardar URL de imagen en base de datos
- [ ] Mostrar imagen en tabla de inventario

## Carga de Imagen Local
- [x] Agregar input de tipo file para seleccionar imagen
- [x] Crear función para subir imagen a S3
- [x] Integrar carga de imagen en diálogo de agregar producto
- [x] Mostrar progreso de carga


## SKU Editable
- [x] Cambiar SKU de select a input de texto
- [x] Permitir que administrador ingrese código personalizado
- [x] Actualizar schema del router para aceptar string en lugar de enum
- [x] Validar que SKU no esté vacío


## Bugs Reportados - Inventario
- [x] Productos registrados no se muestran en la tabla de inventario (RESUELTO)

- [x] Error al guardar producto: problema con conversión de precio (RESUELTO)
- [x] Error al subir imagen: endpoint /api/upload-image no parseaba multipart/form-data (RESUELTO con multer)

## Reportes en PDF (NUEVO - Abril 2025)
- [x] Reporte de Pedidos (con filtros por fecha y estado)
- [x] Reporte de Ventas (por período y método de pago)
- [x] Reporte de Inventario (stock actual con alertas de bajo stock)
- [x] Reporte de Movimientos de Inventario (entradas, salidas, ajustes)
- [x] Reporte Financiero (transacciones y cierres de caja)
- [x] Reporte de Clientes (lista completa con datos de contacto)
- [x] Reporte de Auditoría (historial de cambios del sistema)

## Historial de Cambios / Auditoría (NUEVO - Abril 2025)
- [x] Crear tabla auditLog en base de datos
- [x] Crear API para consultar historial de cambios
- [x] Crear página de reportes con acceso a auditoría
- [x] Registrar CREATE, UPDATE, DELETE en entidades principales
- [x] Incluir usuario, fecha, valores anteriores y nuevos
- [x] Índices para búsquedas eficientes por entidad, usuario y fecha
