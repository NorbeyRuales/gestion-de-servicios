# Contexto del proyecto: Gestor de Servicios Técnicos y Obras

## 1. Objetivo de la aplicación

Crear una aplicación web responsive llamada **Gestor de Servicios**, orientada a registrar, organizar, cobrar y consultar trabajos técnicos y de obra realizados para diferentes clientes.

La aplicación será usada principalmente por una persona que realiza trabajos como:

* Mantenimiento preventivo y correctivo.
* Reparación de máquinas, motores y electrodomésticos.
* Reparación e instalación de freidoras industriales.
* Reparación e instalación de estufas industriales.
* Reparación de microondas, televisores, computadores, impresoras y equipos de cocina.
* Reparación de equipos de barra, zona de empaque y cocina.
* Instalaciones eléctricas, hidráulicas, de gas o de equipos.
* Obra blanca: pintura, estuco, enchape, drywall, acabados, reparación de paredes, techos y pisos.
* Obra gris: muros, pisos, cimentación, mezclas, construcción y ampliaciones.
* Demoliciones, adecuaciones y reparaciones generales.

La finalidad principal es que cada trabajo quede documentado con detalle y posteriormente pueda incluirse en una factura, cuenta de cobro o reporte para el cliente.

---

## 2. Contexto del negocio

El cliente principal tiene actualmente tres restaurantes o sedes, pero puede ampliar a más en el futuro.

Ejemplo:

```text
Restaurantes XYZ
├── Sede Centro
├── Sede Norte
└── Sede Sur
```

También existen clientes ocasionales, como panaderías, cafeterías, negocios pequeños o viviendas particulares.

La aplicación debe permitir manejar:

* Clientes con una sola sede.
* Clientes empresariales con varias sedes.
* Nuevas sedes agregadas en el futuro.
* Historial de trabajos por cliente.
* Historial de trabajos por sede.
* Historial de mantenimientos y reparaciones por equipo.

---

## 3. Regla principal sobre sedes y facturación

Es importante diferenciar dos conceptos:

1. **Sede de ejecución:** lugar donde realmente se realizó el trabajo.
2. **Sede de cobro:** lugar donde se recibe el pago o donde se entrega la factura.

Estos dos datos pueden ser iguales o diferentes.

Ejemplo:

```text
Trabajo 1:
- Sede de ejecución: Sede Norte
- Reparación de freidora industrial

Trabajo 2:
- Sede de ejecución: Sede Sur
- Reparación de pared en cocina

Trabajo 3:
- Sede de ejecución: Sede Centro
- Mantenimiento de estufa industrial

Factura:
- Cliente: Restaurantes XYZ
- Sede de cobro: Sede Centro
- Incluye trabajos de Norte, Sur y Centro
```

La aplicación debe permitir:

* Facturar un único trabajo.
* Facturar varios trabajos de una misma sede.
* Facturar trabajos realizados en dos o más sedes.
* Registrar que el pago se recibió en una sede diferente a la sede donde se hizo el trabajo.
* Mantener el historial técnico correcto en la sede donde se ejecutó cada actividad.

---

## 4. Tipos de trabajo

Cada orden de trabajo debe tener un tipo de servicio. Inicialmente se deben manejar estas opciones:

```text
- Mantenimiento preventivo
- Mantenimiento correctivo
- Reparación
- Instalación
- Diagnóstico
- Visita técnica
- Obra blanca
- Obra gris
- Demolición
- Construcción
- Adecuación
- Reparación eléctrica
- Reparación hidráulica
- Reparación de gas
- Limpieza técnica
- Otro
```

El sistema debe permitir agregar nuevos tipos de servicio en el futuro.

---

## 5. Equipos, activos y áreas

No todos los trabajos se realizan sobre una máquina. Algunos se hacen sobre una zona física, una instalación o una estructura.

Por eso la aplicación debe manejar dos formas de registrar un trabajo:

1. Trabajo relacionado con un equipo o activo.
2. Trabajo relacionado directamente con un área o zona de la sede.

### Ejemplos de equipos o activos

```text
- Freidora industrial
- Estufa industrial
- Horno
- Microondas
- Nevera
- Congelador
- Extractor
- Motor
- Televisor
- Computador POS
- Impresora de cocina
- Impresora de facturación
- Caja registradora
- Equipo de barra
- Ventilador
- Aire acondicionado
- Cámara de seguridad
- Otro equipo
```

Cada equipo debe poder guardar:

```text
- Código interno
- Nombre
- Categoría
- Marca
- Modelo
- Número de serie, opcional
- Área donde se encuentra
- Sede a la que pertenece
- Estado actual
- Fecha de compra, opcional
- Fecha de último mantenimiento
- Observaciones
- Fotos
```

Ejemplo:

```text
Código: FRI-NOR-001
Nombre: Freidora Industrial 01
Categoría: Freidora industrial
Marca: Haceb
Modelo: Industrial 20 litros
Sede: Norte
Área: Cocina
Estado: Operativa
```

### Ejemplos de áreas o zonas

```text
- Cocina
- Barra
- Zona de empaque
- Bodega
- Baños
- Salón
- Oficina
- Fachada
- Techo
- Piso
- Paredes
- Zona externa
- Instalación eléctrica
- Instalación hidráulica
- Instalación de gas
```

Para un trabajo como pintura, reparación de una pared, construcción, demolición o arreglo de tuberías, no debe ser obligatorio seleccionar un equipo.

---

## 6. Órdenes de trabajo

La entidad principal de la aplicación debe ser la **Orden de Trabajo**.

Cada vez que se realice, revise o programe un trabajo, debe crearse una orden.

### Datos principales de una orden de trabajo

```text
- Número o código de orden
- Cliente
- Sede de ejecución
- Área o zona
- Equipo relacionado, opcional
- Tipo de servicio
- Fecha de creación
- Fecha de inicio
- Fecha de finalización
- Técnico responsable
- Estado
- Problema reportado
- Trabajo realizado
- Observaciones
- Pendientes por resolver
```

### Estados de una orden de trabajo

```text
- Pendiente
- Cotizado
- Aprobado
- En proceso
- Terminado
- Cancelado
- Facturado
```

### Costos de una orden

Una orden puede incluir uno o varios ítems de costo.

```text
- Materiales
- Repuestos
- Mano de obra
- Transporte
- Herramientas o alquileres
- Otros cargos
```

Cada ítem debe tener:

```text
- Tipo de ítem
- Descripción
- Cantidad
- Valor unitario
- Subtotal
```

Ejemplo:

```text
Tipo: Repuesto
Descripción: Termocupla para freidora industrial
Cantidad: 1
Valor unitario: $85.000
Subtotal: $85.000
```

La orden debe calcular automáticamente:

```text
Subtotal materiales y repuestos
+ Mano de obra
+ Transporte
+ Otros cargos
= Total de la orden
```

### Fotos y evidencias

Cada orden de trabajo debe permitir adjuntar fotos:

```text
- Foto antes del trabajo
- Foto durante el trabajo
- Foto después del trabajo
- Foto de materiales o repuestos
- Foto de soporte de aprobación, opcional
```

Las fotos se almacenarán en Supabase Storage.

---

## 7. Historial técnico de equipos

Cada equipo debe mostrar todos los trabajos que se le han realizado.

Ejemplo:

```text
Freidora Industrial 01 - FRI-NOR-001

12/06/2026
Mantenimiento preventivo
Limpieza de quemadores y ajuste de válvula de gas.

03/05/2026
Reparación
Cambio de termocupla.

18/02/2026
Reparación
Corrección de fuga de gas.

11/12/2025
Mantenimiento preventivo
Limpieza general y prueba de funcionamiento.
```

El historial debe permitir conocer:

* Cuántas veces se ha reparado un equipo.
* Cuánto dinero se ha invertido en él.
* Cuándo fue su último mantenimiento.
* Qué repuestos se han usado.
* Si requiere mantenimiento próximo o reemplazo.

---

## 8. Facturas y cuentas de cobro

La aplicación debe permitir crear facturas o cuentas de cobro a partir de órdenes de trabajo terminadas.

En la primera versión, la factura será un documento interno o PDF detallado. No se requiere facturación electrónica DIAN inicialmente.

### Reglas de facturación

* Solo las órdenes terminadas pueden ser agregadas a una factura.
* Una orden no debe poder facturarse dos veces.
* Una factura puede incluir uno o varios trabajos.
* Los trabajos de una factura pueden pertenecer a una o varias sedes del mismo cliente.
* La factura debe guardar la sede donde se cobra o se recibe el pago.
* La factura debe mostrar claramente la sede donde se ejecutó cada trabajo.

### Ejemplo de factura consolidada

```text
Cliente: Restaurantes XYZ
Sede de cobro: Centro

SEDE NORTE
- Reparación de freidora industrial.
- Cambio de válvula de gas en estufa.

SEDE SUR
- Reparación y pintura de pared de cocina.

SEDE CENTRO
- Mantenimiento preventivo de estufa industrial.

Subtotal materiales: $...
Subtotal mano de obra: $...
Transporte: $...
Total general: $...
```

### Datos de la factura

```text
- Número de factura
- Cliente
- Sede de cobro
- Fecha de emisión
- Fecha límite de pago, opcional
- Estado de pago
- Observaciones
- Total de materiales
- Total de mano de obra
- Total de transporte
- Descuentos
- Total general
```

### Estados de pago

```text
- Pendiente
- Pago parcial
- Pagado
- Anulado
```

---

## 9. Registro de pagos

Una factura puede pagarse completa o parcialmente.

Cada pago debe registrar:

```text
- Factura relacionada
- Fecha de pago
- Valor recibido
- Método de pago
- Sede donde se recibió el pago
- Observación
- Soporte de pago, opcional
```

Métodos de pago iniciales:

```text
- Efectivo
- Transferencia bancaria
- Nequi
- Bancolombia
- Daviplata
- Otro
```

Ejemplo:

```text
Factura: FAC-00024
Total factura: $1.200.000
Pagado: $700.000
Pendiente: $500.000

Pago registrado:
Fecha: 30/06/2026
Valor: $700.000
Método: Transferencia bancaria
Sede donde se recibió: Sede Centro
```

El estado de la factura debe actualizarse automáticamente según el total abonado.

---

## 10. Módulos principales de la aplicación

La navegación principal debe incluir:

```text
- Inicio
- Clientes
- Sedes
- Equipos y áreas
- Órdenes de trabajo
- Facturas y cobros
- Reportes
- Configuración
```

### Inicio o Dashboard

Debe mostrar:

```text
- Trabajos pendientes
- Trabajos en proceso
- Trabajos terminados sin facturar
- Facturas pendientes
- Total pendiente por cobrar
- Pagos recibidos del mes
- Trabajos recientes
- Botón para registrar trabajo
- Botón para crear factura
```

### Clientes

Debe permitir:

```text
- Crear cliente
- Editar cliente
- Consultar sedes
- Ver historial de trabajos
- Ver facturas
- Ver pagos
- Consultar total pendiente
```

### Sedes

Debe permitir:

```text
- Crear sede
- Editar sede
- Consultar equipos
- Consultar áreas
- Consultar trabajos
- Consultar historial técnico
- Crear nueva orden de trabajo
```

### Equipos y áreas

Debe permitir:

```text
- Registrar equipos
- Editar equipos
- Asociar equipo a una sede y área
- Consultar historial técnico
- Registrar mantenimiento o reparación
- Registrar áreas de una sede
```

### Órdenes de trabajo

Debe permitir:

```text
- Crear orden
- Guardar como borrador
- Agregar materiales y repuestos
- Agregar mano de obra
- Agregar transporte
- Adjuntar fotos
- Cambiar estado
- Marcar como terminada
- Consultar historial
```

### Facturas y cobros

Debe permitir:

```text
- Crear factura de una sede
- Crear factura consolidada de varias sedes
- Seleccionar órdenes terminadas
- Registrar sede de cobro
- Generar PDF
- Registrar pagos parciales o completos
- Consultar facturas pendientes
```

### Reportes

Debe permitir filtrar por fechas, cliente, sede y tipo de trabajo.

Reportes iniciales:

```text
- Ingresos por mes
- Facturas pendientes de pago
- Total recibido
- Total pendiente por cobrar
- Trabajos realizados por sede
- Tipos de trabajo más frecuentes
- Equipos con más reparaciones
- Clientes con mayor facturación
- Gastos en materiales y repuestos
```

---

## 11. Interfaz y experiencia de usuario

La aplicación debe ser responsive y funcionar correctamente en:

```text
- Computador
- Tablet
- Celular
```

Debe estar diseñada para ser usada durante trabajos técnicos, por lo que los formularios deben ser rápidos y claros.

### Diseño esperado

```text
- Fondo claro
- Interfaz limpia
- Azul oscuro como color principal
- Blanco y gris claro para fondos y tarjetas
- Naranja o amarillo para alertas y estados pendientes
- Verde para estados pagados o terminados
- Rojo para estados cancelados o urgentes
- Botones grandes
- Iconos claros
- Tablas ordenadas
- Tarjetas para resúmenes rápidos
```

### Navegación

En escritorio:

```text
- Menú lateral izquierdo
- Área principal de contenido
```

En celular:

```text
- Menú inferior o menú lateral desplegable
- Botón flotante para registrar trabajo
```

---

## 12. Tecnología propuesta

### Frontend

```text
- React
- Vite
- TypeScript
- Tailwind CSS o CSS Modules
- React Router
- React Hook Form
- Zod para validaciones
```

### Backend y base de datos

```text
- Supabase
- PostgreSQL
- Supabase Auth
- Supabase Storage
- Row Level Security (RLS)
```

### Archivos

Supabase Storage debe usarse para:

```text
- Fotos de órdenes de trabajo
- Fotos de equipos
- Soportes de pago
- Facturas o cuentas de cobro en PDF
```

---

## 13. Estructura inicial de base de datos

Tablas principales sugeridas:

```text
profiles
clients
branches
areas
assets
work_orders
work_order_items
work_order_photos
invoices
invoice_work_orders
payments
payment_proofs
```

### profiles

```text
id
full_name
email
role
created_at
```

Roles iniciales:

```text
- admin
- technician
- billing
```

### clients

```text
id
name
document_type
document_number
phone
email
billing_address
main_contact_name
main_contact_phone
created_at
```

### branches

```text
id
client_id
name
address
manager_name
manager_phone
notes
is_active
created_at
```

### areas

```text
id
branch_id
name
description
created_at
```

### assets

```text
id
branch_id
area_id
internal_code
name
category
brand
model
serial_number
status
last_maintenance_date
notes
created_at
```

### work_orders

```text
id
code
client_id
execution_branch_id
area_id
asset_id
service_type
reported_problem
work_performed
observations
pending_items
status
created_by
assigned_to
start_date
completion_date
created_at
updated_at
```

### work_order_items

```text
id
work_order_id
item_type
description
quantity
unit_price
subtotal
created_at
```

Valores posibles para `item_type`:

```text
- material
- spare_part
- labor
- transport
- rental
- other
```

### work_order_photos

```text
id
work_order_id
file_path
photo_type
caption
created_at
```

Valores posibles para `photo_type`:

```text
- before
- during
- after
- evidence
```

### invoices

```text
id
invoice_number
client_id
billing_branch_id
issue_date
due_date
status
materials_total
labor_total
transport_total
discount_total
grand_total
notes
created_by
created_at
```

### invoice_work_orders

Esta tabla relaciona una factura con una o varias órdenes de trabajo.

```text
id
invoice_id
work_order_id
amount
created_at
```

### payments

```text
id
invoice_id
payment_date
amount
payment_method
received_at_branch_id
notes
created_by
created_at
```

### payment_proofs

```text
id
payment_id
file_path
created_at
```

---

## 14. Reglas de negocio importantes

```text
1. Un cliente puede tener muchas sedes.
2. Una sede pertenece a un único cliente.
3. Una sede puede tener muchas áreas.
4. Un área pertenece a una sede.
5. Un equipo pertenece a una sede y opcionalmente a un área.
6. Una orden de trabajo siempre debe tener cliente y sede de ejecución.
7. Una orden puede tener equipo asociado, pero no es obligatorio.
8. Una orden puede corresponder a un área sin relacionarse con un equipo.
9. Una orden terminada puede facturarse.
10. Una orden ya facturada no debe aparecer disponible para crear otra factura.
11. Una factura puede incluir órdenes de una o varias sedes del mismo cliente.
12. La sede de cobro puede ser diferente de las sedes de ejecución.
13. Una factura puede tener pagos parciales.
14. El estado de pago debe calcularse según los pagos registrados.
15. Las fotos y soportes deben almacenarse en Supabase Storage.
16. Los usuarios técnicos no deben poder eliminar facturas ni pagos.
17. Los administradores deben poder gestionar clientes, sedes, equipos, facturas, pagos y reportes.
```

---

## 15. Alcance inicial o MVP

La primera versión debe enfocarse en estas funciones:

```text
1. Autenticación de usuarios.
2. Crear clientes.
3. Crear sedes.
4. Crear áreas.
5. Crear equipos.
6. Crear órdenes de trabajo.
7. Agregar costos, materiales y mano de obra.
8. Adjuntar fotos.
9. Marcar trabajos como terminados.
10. Crear facturas de una o varias sedes.
11. Registrar pagos parciales o completos.
12. Consultar historial de equipos y trabajos.
13. Generar una factura o cuenta de cobro en PDF.
14. Mostrar un dashboard básico de pendientes y cobros.
```

Las funciones de facturación electrónica DIAN, inventario completo de materiales, notificaciones automáticas y cotizaciones avanzadas pueden dejarse para fases posteriores.
