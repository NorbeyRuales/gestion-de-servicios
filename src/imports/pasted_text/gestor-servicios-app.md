Diseña una aplicación web responsive llamada **“Gestor de Servicios”**, pensada para registrar, administrar y facturar trabajos técnicos, mantenimientos, reparaciones y obras realizadas para clientes con una o varias sedes.

La aplicación será usada principalmente por un técnico o administrador que realiza trabajos de mantenimiento de maquinaria, motores, electrodomésticos, freidoras industriales, estufas, microondas, televisores, computadores, impresoras de cocina, equipos de barra, equipos de empaque, instalaciones eléctricas, hidráulicas, reparaciones, obra blanca, obra gris, demoliciones y construcciones.

El diseño debe sentirse profesional, claro, moderno y práctico para usar tanto desde computador como desde celular mientras se está trabajando en una sede. Usar una interfaz limpia, con buena jerarquía visual, botones grandes, formularios fáciles de llenar, iconos claros y colores sobrios relacionados con mantenimiento y gestión empresarial. Usar principalmente blanco, gris claro, azul oscuro y un color de acento naranja o amarillo para alertas, estados pendientes y acciones importantes.

Crear un sistema de diseño consistente con:

* Barra lateral izquierda en escritorio.
* Menú inferior o menú desplegable en móvil.
* Tarjetas con bordes suaves y sombras ligeras.
* Botones principales destacados.
* Tablas claras para facturas, pagos y órdenes de trabajo.
* Etiquetas de estado con colores: pendiente, en proceso, terminado, facturado, pago parcial y pagado.
* Formularios con campos amplios y fáciles de usar.
* Diseño responsive para escritorio, tablet y celular.

Crear las siguientes pantallas conectadas como un prototipo navegable:

1. **Pantalla de inicio o Dashboard**
   Mostrar un resumen general del trabajo:

* Trabajos pendientes.
* Trabajos en proceso.
* Trabajos terminados sin facturar.
* Facturas pendientes de pago.
* Total pendiente por cobrar.
* Botón principal “+ Registrar trabajo”.
* Botón secundario “+ Crear factura”.
* Lista de trabajos recientes o del día.
* Filtros por cliente, sede y estado.

Usar datos de ejemplo como:
Cliente: Restaurantes XYZ.
Sedes: Centro, Norte y Sur.
Ejemplos de trabajos: reparación de freidora, mantenimiento de estufa, pintura de pared, cambio de válvula de gas, reparación de impresora de cocina.

2. **Pantalla de Clientes**
   Mostrar una lista de clientes con:

* Nombre o razón social.
* Número de sedes.
* Número de trabajos pendientes.
* Total pendiente de pago.
* Teléfono y contacto principal.
* Botón “Ver cliente”.
* Botón “+ Nuevo cliente”.

Agregar como ejemplo principal:
Restaurantes XYZ — 3 sedes activas.

También agregar algunos clientes ocasionales como:

* Panadería La Estrella.
* Cliente particular Juan Pérez.
* Cafetería Central.

3. **Detalle de Cliente**
   Al entrar a un cliente, mostrar:

* Nombre del cliente.
* NIT o cédula.
* Teléfono.
* Correo.
* Dirección de facturación.
* Contacto administrativo.
* Resumen de facturas pendientes.
* Total pendiente por cobrar.
* Sección de sedes.
* Botón “+ Agregar sede”.
* Historial reciente de órdenes de trabajo.
* Historial de facturas.

Mostrar tarjetas para las sedes:

* Sede Centro.
* Sede Norte.
* Sede Sur.

Cada tarjeta debe mostrar dirección, encargado, teléfono, trabajos pendientes y botón “Ver sede”.

4. **Detalle de Sede**
   Diseñar una pantalla para consultar toda la información de una sede específica.

Mostrar:

* Nombre de la sede.
* Dirección.
* Encargado.
* Teléfono.
* Estado de trabajos pendientes.
* Botón “+ Nuevo trabajo”.
* Botón “Ver historial”.
* Pestañas o secciones: Equipos, Áreas, Trabajos, Facturas relacionadas.

En la sección de equipos mostrar tarjetas o tabla con:

* Freidora industrial 01.
* Estufa industrial.
* Microondas.
* Impresora de cocina.
* Computador POS.
* Televisor de barra.
* Motor extractor.

Cada equipo debe mostrar:

* Código interno.
* Categoría.
* Marca.
* Modelo.
* Área donde está ubicado.
* Estado actual.
* Fecha del último mantenimiento.
* Botón “Ver historial”.
* Botón “Registrar mantenimiento”.

En la sección de áreas mostrar:

* Cocina.
* Barra.
* Zona de empaque.
* Bodega.
* Baño.
* Salón.
* Oficina.
* Fachada.
* Instalación eléctrica.
* Instalación hidráulica.

5. **Detalle de Equipo**
   Crear una pantalla de historial técnico de un equipo, usando como ejemplo una freidora industrial.

Mostrar:

* Nombre: Freidora Industrial 01.
* Código: FRI-NOR-001.
* Ubicación: Cocina, Sede Norte.
* Marca, modelo y capacidad.
* Estado actual: Operativa / Requiere revisión.
* Fecha de último mantenimiento.
* Botón “Registrar mantenimiento”.
* Botón “Registrar reparación”.

Mostrar una línea de tiempo o historial de trabajos:

* Cambio de termocupla.
* Limpieza de quemadores.
* Ajuste de válvula de gas.
* Reparación de fuga.
* Mantenimiento preventivo.

Cada registro debe mostrar fecha, tipo de servicio, técnico responsable, costo y estado.

6. **Pantalla Nueva Orden de Trabajo**
   Esta es la pantalla más importante de la aplicación.

Diseñar un formulario paso a paso o en secciones claras.

Campos:

* Cliente.
* Sede donde se realizó el trabajo.
* Área o zona.
* Equipo relacionado, opcional.
* Tipo de trabajo.
* Fecha.
* Técnico responsable.
* Estado.

Opciones de tipo de trabajo:

* Mantenimiento preventivo.
* Mantenimiento correctivo.
* Reparación.
* Instalación.
* Diagnóstico.
* Visita técnica.
* Obra blanca.
* Obra gris.
* Demolición.
* Construcción.
* Adecuación.
* Reparación eléctrica.
* Reparación hidráulica.

Campos de descripción:

* Problema reportado.
* Trabajo realizado.
* Observaciones.
* Pendientes por resolver.

Sección de costos:

* Materiales.
* Repuestos.
* Mano de obra.
* Transporte.
* Otros cargos.
* Total calculado automáticamente.

Sección de materiales y repuestos con tabla:

* Descripción.
* Cantidad.
* Valor unitario.
* Subtotal.
* Botón “+ Agregar ítem”.

Sección de fotos:

* Foto antes.
* Foto durante.
* Foto después.
* Botón “Tomar foto”.
* Botón “Subir foto”.

Botones al final:

* Guardar como borrador.
* Marcar como terminado.
* Guardar y crear factura.

Incluir un ejemplo de orden:
Cliente: Restaurantes XYZ.
Sede: Norte.
Área: Cocina.
Equipo: Freidora Industrial 01.
Tipo: Reparación.
Problema: La freidora no enciende correctamente.
Trabajo realizado: Se revisó el sistema de gas, se cambió la termocupla y se ajustó la válvula de gas.
Estado: Terminado.

7. **Pantalla de Facturas y Cobros**
   Crear una pantalla donde se puedan generar facturas a partir de órdenes de trabajo terminadas.

Debe permitir dos tipos de factura:

* Factura de trabajos realizados en una sola sede.
* Factura consolidada con trabajos realizados en dos o más sedes.

Mostrar una tabla de trabajos disponibles para facturar con casillas de selección.

Columnas:

* Seleccionar.
* Sede donde se realizó.
* Fecha.
* Tipo de trabajo.
* Descripción.
* Materiales.
* Mano de obra.
* Total.
* Estado.

Agregar un selector llamado:
“Sede donde se cobra o se recibe el pago”.

Importante: aunque una factura reúna trabajos de varias sedes, cada trabajo debe mostrar claramente la sede donde se ejecutó.

Usar este ejemplo:
Cliente: Restaurantes XYZ.
Sede de cobro: Sede Centro.

Trabajos incluidos:

* Sede Norte: Reparación de freidora industrial.
* Sede Norte: Cambio de válvula de gas.
* Sede Sur: Reparación y pintura de pared de cocina.
* Sede Centro: Mantenimiento de estufa industrial.

Mostrar:

* Subtotal de materiales.
* Subtotal de mano de obra.
* Transporte.
* Descuentos.
* Total general.
* Estado de pago.
* Botones “Guardar factura”, “Generar PDF”, “Registrar pago”.

8. **Vista previa de Factura o Cuenta de Cobro**
   Diseñar una pantalla tipo documento profesional lista para exportar a PDF.

Debe mostrar:

* Logo o nombre del negocio.
* Número de factura.
* Fecha.
* Datos del cliente.
* Sede donde se cobra.
* Tabla de trabajos agrupados por sede de ejecución.
* Descripción detallada de cada trabajo.
* Materiales y repuestos.
* Mano de obra.
* Totales.
* Estado de pago.
* Espacio para firma o aprobación del cliente.

Usar un formato claro y profesional, con el siguiente concepto:
“Factura / Cuenta de cobro por servicios de mantenimiento, reparación, instalación y obras.”

9. **Pantalla de Registro de Pago**
   Diseñar una pantalla para registrar pagos completos o parciales de una factura.

Mostrar:

* Número de factura.
* Cliente.
* Valor total.
* Valor pagado.
* Valor pendiente.
* Historial de pagos.

Formulario:

* Valor recibido.
* Fecha de pago.
* Método de pago: efectivo, transferencia, Nequi, Bancolombia, otro.
* Sede donde se recibió el pago.
* Observación.
* Adjuntar soporte de pago.

Botón: “Guardar pago”.

10. **Pantalla de Reportes**
    Crear una pantalla de reportes con gráficos y filtros.

Mostrar:

* Ingresos por mes.
* Trabajos realizados por sede.
* Tipos de trabajo más frecuentes.
* Equipos con más reparaciones.
* Facturas pendientes.
* Clientes con mayor facturación.
* Total recibido y total pendiente por cobrar.

Filtros:

* Rango de fechas.
* Cliente.
* Sede.
* Tipo de trabajo.
* Estado de factura.

Usar gráficos simples, tablas claras y tarjetas de resumen.

La navegación principal debe incluir:

* Inicio.
* Clientes.
* Sedes.
* Equipos y áreas.
* Órdenes de trabajo.
* Facturas y cobros.
* Reportes.
* Configuración.

Crear datos ficticios realistas para mostrar el funcionamiento. Priorizar claridad, facilidad de uso y rapidez para registrar trabajos desde un celular. La aplicación debe dar sensación de ser una herramienta profesional para controlar servicios técnicos, obras, costos, facturas y pagos de clientes con múltiples restaurantes o sedes.
