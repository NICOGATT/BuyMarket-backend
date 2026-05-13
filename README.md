# Buy Market

Buy Market es una aplicación multiplataforma para Android, iOS y web orientada a la compra, venta y entrega de productos entre usuarios. La propuesta combina un marketplace de productos, similar a Mercado Libre, con un sistema de entregas rápidas o programadas, similar a PedidosYa.

La idea principal es que un usuario pueda comprar un producto publicado, por ejemplo un teclado, y recibirlo en su dirección mediante un repartidor asignado por la plataforma. La entrega puede ser inmediata, para recibir el producto en el día, o programada para una fecha y hora definida.

## Objetivo

Permitir que cualquier usuario registrado pueda comprar productos, publicar productos para vender, coordinar entregas con repartidores, pagar desde la aplicación y administrar saldos internos de forma simple y segura.

## Plataformas

- Android
- iOS
- Web

## Actores del sistema

- Usuario comprador: persona registrada que busca, compra y recibe productos.
- Usuario vendedor: persona registrada que publica productos, recibe ventas y retira dinero.
- Repartidor: persona encargada de retirar el producto en la dirección del vendedor y entregarlo al comprador.
- Administrador: persona encargada de gestionar usuarios, publicaciones, pedidos, pagos y reclamos.
- Sistema de IA: asistente automático para clasificación, moderación inicial y atención de reclamos cuando corresponda.

## Requerimientos funcionales

### RF01 - Registro de usuario

El sistema debe permitir que una persona se registre usando email, teléfono o una cuenta externa.

### RF02 - Inicio de sesión

El sistema debe permitir que el usuario inicie sesión de forma segura.

### RF03 - Compra de productos

El sistema debe permitir que cualquier usuario registrado pueda comprar productos publicados.

### RF04 - Activación como vendedor

El sistema debe permitir que cualquier usuario registrado pueda publicar productos sin requerir aprobación manual previa.

La publicación debe validarse automáticamente verificando:

- Que la categoría exista dentro de las categorías disponibles.
- Que las imágenes correspondan al producto publicado.

Las publicaciones cargadas en la categoría "Otros" deben pasar por una verificación manual previa.

### RF05 - Publicación de productos

El sistema debe permitir publicar productos con:

- Título
- Descripción
- Precio
- Categoría
- Fotos y/o videos
- Stock disponible
- Dirección de retiro
- Horario de disponibilidad

### RF06 - Edición de productos

El sistema debe permitir que el usuario edite o elimine sus propias publicaciones.

### RF07 - Búsqueda de productos

El sistema debe permitir buscar productos por:

- Nombre
- Categoría
- Ubicación
- Disponibilidad inmediata

### RF08 - Carrito de compras

El sistema debe permitir agregar productos al carrito antes de confirmar la compra.

### RF09 - Pedido inmediato

El sistema debe permitir que una compra se realice con entrega inmediata, para que el comprador reciba el producto en su dirección durante el día.

### RF10 - Pedido programado

El sistema debe permitir programar una entrega para una fecha y hora específica.

Cuando una entrega esté programada, el sistema debe avisar al repartidor con anticipación. Por ejemplo, si la entrega está definida para una hora determinada, el sistema debe notificar al repartidor 30 minutos antes para que retire y entregue el producto.

### RF11 - Asignación de repartidor

El sistema debe asignar un repartidor disponible para retirar el producto en la dirección del vendedor y entregarlo al comprador.

### RF12 - Seguimiento del pedido

El sistema debe permitir ver el estado del pedido:

- Pendiente
- Aceptado
- Retirado
- En camino
- Entregado
- Cancelado

### RF13 - Pago del cliente

El sistema debe permitir que el comprador pague el producto y el envío desde la aplicación.

### RF14 - Saldo del vendedor

El sistema debe acreditar el dinero de la venta en una cuenta interna del vendedor.

### RF15 - Carga de CBU o alias

El sistema debe solicitar CBU o alias únicamente cuando el vendedor quiera retirar su dinero.

### RF16 - Retiro de dinero

El sistema debe permitir al vendedor retirar su dinero:

- En el momento
- En una fecha diferida
- De forma semanal

### RF17 - Notificaciones

El sistema debe enviar notificaciones sobre:

- Compra realizada
- Producto vendido
- Repartidor asignado
- Pedido en camino
- Dinero disponible

### RF18 - Calificaciones

El sistema debe permitir calificar al comprador, vendedor y repartidor.

### RF19 - Panel administrativo

El sistema debe permitir que un administrador gestione:

- Usuarios
- Publicaciones
- Pedidos
- Pagos
- Reclamos

Los reclamos deben poder ser atendidos por el dueño de la aplicación o asistidos mediante IA.

## Casos de uso

### CU01 - Registrar usuario

**Actor principal:** Usuario no registrado

**Objetivo:** Crear una cuenta en Buy Market.

**Precondiciones:**

- El usuario no debe tener una cuenta activa con los mismos datos.

**Flujo principal:**

1. El usuario ingresa a la opción de registro.
2. El sistema solicita email, teléfono, password, dni, nombre, apellido o cuenta externa.
3. El usuario carga los datos requeridos.
4. El sistema valida la información.
5. El sistema crea la cuenta.
6. El sistema permite el acceso del usuario a la aplicación.

**Flujos alternativos:**

- Si el email o teléfono o password ya está registrado, el sistema informa el error.
- Si los datos son inválidos, el sistema solicita corregirlos.

**Postcondición:**

- El usuario queda registrado en el sistema.

### CU02 - Iniciar sesión

**Actor principal:** Usuario registrado

**Objetivo:** Acceder a la cuenta de forma segura.

**Precondiciones:**

- El usuario debe estar registrado.

**Flujo principal:**

1. El usuario ingresa sus credenciales.
2. El sistema valida los datos.
3. El sistema inicia la sesión.
4. El usuario accede a la aplicación.

**Flujos alternativos:**

- Si las credenciales son incorrectas, el sistema informa el error.
- Si la cuenta está bloqueada o suspendida, el sistema impide el acceso.

**Postcondición:**

- El usuario queda autenticado.

### CU03 - Publicar producto

**Actor principal:** Usuario vendedor

**Objetivo:** Crear una publicación de producto.

**Precondiciones:**

- El usuario debe estar registrado e iniciar sesión.

**Flujo principal:**

1. El usuario ingresa a la opción de publicar producto.
2. El sistema solicita título, descripción, precio, categoría, fotos o videos, stock, dirección de retiro y horario de disponibilidad.
3. El usuario completa la información.
4. El sistema valida que la categoría exista.
5. El sistema verifica que las imágenes correspondan al producto.
6. El sistema publica el producto.

**Flujos alternativos:**

- Si la categoría seleccionada es "Otros", la publicación queda pendiente de revisión manual.
- Si faltan datos obligatorios, el sistema solicita completarlos.
- Si la imagen no corresponde al producto, el sistema rechaza o deja pendiente la publicación.

**Postcondición:**

- El producto queda publicado o pendiente de aprobación, según corresponda.

### CU04 - Editar o eliminar producto

**Actor principal:** Usuario vendedor

**Objetivo:** Modificar o eliminar una publicación propia.

**Precondiciones:**

- El usuario debe estar autenticado.
- La publicación debe pertenecer al usuario.

**Flujo principal:**

1. El usuario accede a sus publicaciones.
2. El sistema muestra los productos publicados por el usuario.
3. El usuario selecciona una publicación.
4. El usuario edita los datos o solicita eliminarla.
5. El sistema valida la acción.
6. El sistema guarda los cambios o elimina la publicación.

**Flujos alternativos:**

- Si el usuario intenta modificar una publicación ajena, el sistema bloquea la acción.
- Si la publicación tiene una compra en curso, el sistema puede restringir su eliminación.

**Postcondición:**

- La publicación queda actualizada o eliminada.

### CU05 - Buscar producto

**Actor principal:** Usuario comprador

**Objetivo:** Encontrar productos disponibles para comprar.

**Precondiciones:**

- Deben existir productos publicados.

**Flujo principal:**

1. El usuario ingresa una búsqueda o selecciona filtros.
2. El sistema permite filtrar por nombre, categoría, ubicación o disponibilidad inmediata.
3. El sistema muestra los resultados.
4. El usuario selecciona un producto para ver el detalle.

**Flujos alternativos:**

- Si no hay resultados, el sistema informa que no se encontraron productos.

**Postcondición:**

- El usuario visualiza productos relacionados con su búsqueda.

### CU06 - Agregar producto al carrito

**Actor principal:** Usuario comprador

**Objetivo:** Guardar productos antes de confirmar la compra.

**Precondiciones:**

- El usuario debe estar autenticado.
- El producto debe estar publicado y con stock disponible.

**Flujo principal:**

1. El usuario selecciona un producto.
2. El usuario indica cantidad.
3. El sistema valida el stock.
4. El sistema agrega el producto al carrito.
5. El sistema muestra el carrito actualizado.

**Flujos alternativos:**

- Si no hay stock suficiente, el sistema informa la disponibilidad real.

**Postcondición:**

- El producto queda agregado al carrito.

### CU07 - Comprar producto

**Actor principal:** Usuario comprador

**Objetivo:** Confirmar la compra de uno o más productos.

**Precondiciones:**

- El usuario debe estar autenticado.
- El carrito debe tener productos disponibles.

**Flujo principal:**

1. El usuario revisa el carrito.
2. El usuario confirma la dirección de entrega.
3. El usuario selecciona entrega inmediata o programada.
4. El sistema calcula el total del producto y del envío.
5. El usuario realiza el pago.
6. El sistema confirma la compra.
7. El sistema notifica al vendedor.

**Flujos alternativos:**

- Si el pago falla, el sistema informa el error y no confirma la compra.
- Si el stock cambia antes de pagar, el sistema actualiza el carrito.

**Postcondición:**

- Se crea un pedido asociado a la compra.

### CU08 - Solicitar entrega inmediata

**Actor principal:** Usuario comprador

**Objetivo:** Recibir el producto durante el día.

**Precondiciones:**

- La compra debe estar confirmada.
- Debe existir disponibilidad del vendedor y de repartidores.

**Flujo principal:**

1. El usuario selecciona entrega inmediata.
2. El sistema valida la disponibilidad del vendedor.
3. El sistema busca repartidores disponibles.
4. El sistema asigna un repartidor.
5. El sistema notifica al comprador, vendedor y repartidor.

**Flujos alternativos:**

- Si no hay repartidores disponibles, el sistema informa la situación y ofrece reintentar o programar la entrega.

**Postcondición:**

- El pedido queda con repartidor asignado o pendiente de asignación.

### CU09 - Solicitar entrega programada

**Actor principal:** Usuario comprador

**Objetivo:** Programar la entrega de un producto para una fecha y hora determinada.

**Precondiciones:**

- La compra debe estar confirmada.
- El horario elegido debe estar dentro de la disponibilidad del vendedor.

**Flujo principal:**

1. El usuario selecciona entrega programada.
2. El usuario elige fecha y hora.
3. El sistema valida el horario contra la disponibilidad del vendedor.
4. El sistema registra la programación.
5. El sistema notifica la programación al vendedor.
6. El sistema notifica al repartidor 30 minutos antes del horario definido.

**Flujos alternativos:**

- Si el horario no está disponible, el sistema solicita elegir otro.
- Si no hay repartidor disponible cerca del horario, el sistema mantiene el pedido pendiente de asignación o propone otro horario.

**Postcondición:**

- El pedido queda programado.

### CU10 - Asignar repartidor

**Actor principal:** Sistema

**Actores secundarios:** Repartidor, vendedor, comprador

**Objetivo:** Elegir un repartidor disponible para completar la entrega.

**Precondiciones:**

- Debe existir un pedido confirmado.
- Debe existir al menos un repartidor disponible o potencialmente disponible.

**Flujo principal:**

1. El sistema identifica la dirección de retiro del vendedor.
2. El sistema identifica la dirección de entrega del comprador.
3. El sistema busca repartidores disponibles.
4. El sistema asigna el repartidor más conveniente según ubicación, disponibilidad y horario.
5. El sistema notifica al repartidor.
6. El sistema actualiza el estado del pedido.

**Flujos alternativos:**

- Si el repartidor rechaza o no responde, el sistema busca otro repartidor.
- Si no hay repartidores disponibles, el pedido queda pendiente de asignación.

**Postcondición:**

- El pedido queda asignado a un repartidor o pendiente de asignación.

### CU11 - Consultar seguimiento del pedido

**Actor principal:** Usuario comprador

**Actores secundarios:** Vendedor, repartidor

**Objetivo:** Ver el estado actual del pedido.

**Precondiciones:**

- El usuario debe estar autenticado.
- Debe existir un pedido asociado al usuario.

**Flujo principal:**

1. El usuario ingresa al detalle del pedido.
2. El sistema muestra el estado actual.
3. El sistema actualiza el estado cuando el vendedor o repartidor avanza el proceso.

**Estados posibles:**

- Pendiente
- Aceptado
- Retirado
- En camino
- Entregado
- Cancelado

**Flujos alternativos:**

- Si el pedido fue cancelado, el sistema muestra el motivo cuando esté disponible.

**Postcondición:**

- El usuario conoce el estado actualizado del pedido.

### CU12 - Pagar compra

**Actor principal:** Usuario comprador

**Objetivo:** Pagar el producto y el envío desde la aplicación.

**Precondiciones:**

- El usuario debe estar autenticado.
- El pedido debe tener un monto calculado.

**Flujo principal:**

1. El sistema muestra el total de productos y envío.
2. El usuario selecciona un medio de pago.
3. El sistema procesa el pago.
4. El sistema confirma el pago.
5. El sistema habilita la preparación y entrega del pedido.

**Flujos alternativos:**

- Si el pago es rechazado, el sistema informa el error.
- Si el proveedor de pago no responde, el sistema deja el pago pendiente o solicita reintentar.

**Postcondición:**

- El pedido queda pagado o pendiente de pago.

### CU13 - Acreditar saldo al vendedor

**Actor principal:** Sistema

**Objetivo:** Registrar el dinero de una venta en la cuenta interna del vendedor.

**Precondiciones:**

- El pago del comprador debe estar confirmado.
- La venta debe estar asociada a un vendedor.

**Flujo principal:**

1. El sistema identifica el vendedor de la publicación.
2. El sistema calcula el monto correspondiente.
3. El sistema acredita el dinero en la cuenta interna del vendedor.
4. El sistema notifica que el dinero está disponible según las reglas de la plataforma.

**Flujos alternativos:**

- Si existe un reclamo o retención, el sistema puede dejar el saldo pendiente.

**Postcondición:**

- El saldo del vendedor queda actualizado.

### CU14 - Cargar CBU o alias

**Actor principal:** Usuario vendedor

**Objetivo:** Registrar datos bancarios para retirar dinero.

**Precondiciones:**

- El usuario debe estar autenticado.
- El usuario debe tener saldo disponible o intención de configurar retiros.

**Flujo principal:**

1. El vendedor solicita retirar dinero.
2. El sistema le debe de pedir el CBU o alias
3. El vendedor carga los datos.
4. El sistema valida y guarda la información.

**Flujos alternativos:**

- Si el CBU o alias es inválido, el sistema solicita corregirlo.

**Postcondición:**

- El vendedor tiene datos bancarios cargados para retirar dinero.

### CU15 - Retirar dinero

**Actor principal:** Usuario vendedor

**Objetivo:** Transferir el saldo disponible a una cuenta bancaria.

**Precondiciones:**

- El vendedor debe estar autenticado.
- El vendedor debe tener saldo disponible.
- El vendedor debe tener CBU o alias cargado.

**Flujo principal:**

1. El vendedor ingresa a su saldo.
2. El sistema muestra el dinero disponible.
3. El vendedor elige retirar en el momento, en una fecha diferida o de forma semanal.
4. El sistema registra la solicitud.
5. El sistema procesa o agenda el retiro.
6. El sistema notifica el estado del retiro.

**Flujos alternativos:**

- Si no hay saldo suficiente, el sistema impide la operación.
- Si los datos bancarios son inválidos, el sistema solicita actualizarlos.

**Postcondición:**

- El retiro queda procesado o programado.

### CU16 - Enviar notificaciones

**Actor principal:** Sistema

**Objetivo:** Informar eventos importantes a los usuarios.

**Precondiciones:**

- Debe ocurrir un evento relevante dentro de la aplicación.

**Flujo principal:**

1. El sistema detecta un evento.
2. El sistema identifica a los usuarios afectados.
3. El sistema genera la notificación.
4. El sistema envía la notificación por el canal disponible.

**Eventos principales:**

- Compra realizada
- Producto vendido
- Repartidor asignado
- Pedido en camino
- Dinero disponible

**Flujos alternativos:**

- Si el usuario no tiene notificaciones push habilitadas, el sistema puede usar email, SMS o notificaciones internas.

**Postcondición:**

- El usuario recibe o puede consultar la notificación.

### CU17 - Calificar operación

**Actor principal:** Comprador, vendedor o repartidor

**Objetivo:** Registrar una calificación luego de una operación.

**Precondiciones:**

- El pedido debe estar finalizado.
- El usuario debe haber participado en la operación.

**Flujo principal:**

1. El sistema habilita la opción de calificar.
2. El usuario selecciona una puntuación.
3. El usuario puede agregar un comentario.
4. El sistema guarda la calificación.
5. El sistema actualiza la reputación correspondiente.

**Flujos alternativos:**

- Si el usuario intenta calificar una operación en la que no participó, el sistema bloquea la acción.

**Postcondición:**

- La calificación queda registrada.

### CU18 - Gestionar panel administrativo

**Actor principal:** Administrador

**Objetivo:** Administrar la operación general de la plataforma.

**Precondiciones:**

- El administrador debe estar autenticado con permisos válidos.

**Flujo principal:**

1. El administrador ingresa al panel administrativo.
2. El sistema muestra módulos de usuarios, publicaciones, pedidos, pagos y reclamos.
3. El administrador consulta, filtra y gestiona la información.
4. El administrador toma acciones según el caso.
5. El sistema registra las acciones realizadas.

**Flujos alternativos:**

- Si el administrador no tiene permisos suficientes, el sistema restringe el acceso.

**Postcondición:**

- La entidad gestionada queda actualizada.

### CU19 - Gestionar reclamo

**Actor principal:** Comprador, vendedor o repartidor

**Actores secundarios:** Administrador, sistema de IA

**Objetivo:** Resolver un problema relacionado con una compra, publicación, pago o entrega.

**Precondiciones:**

- El usuario debe estar autenticado.
- Debe existir un motivo de reclamo válido.

**Flujo principal:**

1. El usuario crea un reclamo.
2. El sistema solicita motivo, descripción y evidencia si corresponde.
3. El sistema registra el reclamo.
4. El sistema puede derivar el reclamo a IA para una primera respuesta o clasificación.
5. El sistema deriva el reclamo al dueño de la aplicación o administrador cuando requiere intervención manual.
6. El administrador resuelve el reclamo.
7. El sistema notifica la resolución.

**Flujos alternativos:**

- Si el reclamo puede resolverse automáticamente, la IA sugiere o aplica una respuesta según las reglas permitidas.
- Si falta información, el sistema solicita datos adicionales.

**Postcondición:**

- El reclamo queda resuelto, rechazado o pendiente de revisión.

### CU20 - Ingresar dinero a la wallet de la app

**Actor principal:** Usuario comprador o usuario vendedor

**Objetivo:** Cargar dinero en la wallet interna de la aplicación para usarlo en compras, envíos u otras operaciones permitidas.

**Precondiciones:**

- El usuario debe estar autenticado en el sistema.
- El usuario debe tener una cuenta bancaria o medio de pago válido asociado a su nombre.
- El medio de pago debe estar habilitado para transferir dinero a la wallet.

**Flujo principal:**

1. El usuario ingresa a la sección de wallet o saldo de la aplicación.
2. El sistema muestra el saldo disponible actual.
3. El usuario selecciona la opción de ingresar dinero.
4. El sistema solicita el monto a cargar.
5. El usuario ingresa el monto.
6. El sistema valida que el monto sea mayor a cero y que cumpla con los límites definidos por la plataforma.
7. El sistema muestra los medios de pago o cuentas bancarias disponibles.
8. El usuario selecciona el medio de pago o cuenta bancaria desde donde transferirá el dinero.
9. El sistema muestra un resumen de la operación con monto, medio seleccionado y posibles comisiones.
10. El usuario confirma la carga de dinero.
11. El sistema procesa la transferencia o solicitud de pago.
12. El sistema acredita el monto en la wallet cuando la operación es confirmada.
13. El sistema muestra el saldo actualizado.
14. El sistema envía una notificación o comprobante de la operación.

**Flujos alternativos:**

- Si el usuario no está autenticado, el sistema debe impedir la operación e informar que debe iniciar sesión.
- Si el monto ingresado es inválido, el sistema debe solicitar que se corrija.
- Si el medio de pago es rechazado, el sistema debe informar el error y permitir seleccionar otro medio.
- Si la transferencia queda pendiente, el sistema debe mostrar la operación como pendiente hasta recibir confirmación.
- Si la cuenta bancaria no pertenece al usuario o no puede validarse, el sistema debe rechazar la carga.

**Postcondición:**

- El dinero queda acreditado en la wallet del usuario o la operación queda registrada como pendiente, rechazada o fallida.



## Especificaciones generales de casos de uso

### Seguridad

- Las contraseñas deben almacenarse cifradas o hasheadas.
- Las sesiones deben manejarse mediante tokens seguros.
- Los permisos deben impedir que un usuario modifique datos de otro usuario.
- Las operaciones administrativas deben quedar auditadas.

### Validaciones de publicaciones

- Una publicación debe tener todos los campos obligatorios completos.
- El precio debe ser mayor a cero.
- El stock no puede ser negativo.
- La categoría debe existir.
- Las publicaciones en "Otros" requieren revisión manual.
- Las imágenes deben coincidir con el producto publicado cuando se use verificación automática.

### Estados de pedido

Los pedidos deben avanzar de forma controlada entre estados.

Flujo esperado:

1. Pendiente
2. Aceptado
3. Retirado
4. En camino
5. Entregado

Estado alternativo:

- Cancelado

### Reglas de entrega

- La entrega inmediata depende de la disponibilidad del vendedor y de repartidores.
- La entrega programada debe respetar el horario de disponibilidad del vendedor.
- El sistema debe avisar al repartidor antes del horario programado.
- El repartidor debe conocer dirección de retiro y dirección de entrega.

### Reglas de pagos y saldos

- El comprador paga producto y envío desde la aplicación.
- El vendedor recibe el dinero en una cuenta interna.
- El CBU o alias se solicita solamente al retirar dinero.
- Los retiros pueden ser inmediatos, diferidos o semanales.
- El sistema puede retener saldo si existe un reclamo activo.

### Reglas de reputación

- Solo pueden calificar usuarios que participaron en una operación.
- Las calificaciones deben asociarse a un pedido finalizado.
- La reputación debe poder aplicar a comprador, vendedor y repartidor.

## Entidades principales sugeridas

- Usuario
- Rol
- Producto
- Categoría
- Multimedia de producto
- Carrito
- Item de carrito
- Pedido
- Item de pedido
- Entrega
- Repartidor
- Pago
- Saldo interno
- Retiro de dinero
- Notificación
- Calificación
- Reclamo
- Auditoría administrativa

## Alcance inicial sugerido

Para una primera versión, se recomienda priorizar:

1. Registro e inicio de sesión.
2. Publicación, edición y búsqueda de productos.
3. Carrito y compra.
4. Pago simulado o integración básica de pagos.
5. Pedido inmediato.
6. Estados del pedido.
7. Notificaciones básicas.
8. Saldo interno del vendedor.
9. Panel administrativo básico.

Luego se puede agregar:

- Entrega programada avanzada.
- Asignación inteligente de repartidores.
- Verificación automática de imágenes con IA.
- Gestión avanzada de reclamos con IA.
- Retiros automáticos semanales.
- Calificaciones y reputación avanzada.
