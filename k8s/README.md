# MySQL externo

Instancia independiente en el namespace `mysql-externo`, con su propio volumen de 5 GiB. Requiere una StorageClass predeterminada y recursos disponibles en el VPS. No modifica los recursos de `karaoki`; el namespace por sí solo no aísla la red.

## Desplegar

1. Cambia ambas contraseñas en `01-secret.yaml`. Guarda la contraseña de `appuser` para conectar tu app.
2. Copia esta carpeta al VPS y entra en ella.
3. Ejecuta:

```bash
kubectl apply -f 00-namespace.yaml
kubectl apply -f 01-secret.yaml -f 02-storage.yaml -f 03-deployment.yaml -f 04-service.yaml
kubectl rollout status deployment/mysql -n mysql-externo --timeout=300s
kubectl get svc mysql -n mysql-externo
```

En `PORT(S)`, si aparece `3306:31234/TCP`, el puerto externo es `31234`. Permite entrada TCP a ese puerto en los firewalls activos del VPS y de Contabo. `EXTERNAL-IP: <none>` es normal para NodePort.

## Conectar

- Host: IP pública del VPS.
- Puerto: NodePort asignado.
- Base: `appdb`.
- Usuario: `appuser`.
- Contraseña: la definida en `MYSQL_PASSWORD`.

Desde otro equipo, reemplaza IP y puerto:

```bash
mysql --protocol=TCP -h IP_PUBLICA_VPS -P 31234 -u appuser -p appdb
```

Luego ejecuta `SELECT DATABASE(), VERSION();`.

## Si no arranca

```bash
kubectl get pods,pvc -n mysql-externo
kubectl get storageclass
kubectl get events -n mysql-externo --sort-by=.metadata.creationTimestamp
kubectl logs deployment/mysql -n mysql-externo --tail=100
```

Si el PVC queda en Pending, revisa que haya una StorageClass predeterminada y un provisionador operativo.

Las variables del Secret crean usuarios y base únicamente al inicializar un volumen vacío. Cambiar el Secret después no cambia automáticamente las contraseñas existentes de MySQL.
