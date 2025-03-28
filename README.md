# kroki-server
A setup to bringup a kroki server and include a custom demo site

## Bringup Steps

Run the `setup-kroki-server.sh start` script to bring up a kroki server to be used locally. 

To access the custom demo site, go to https://localhost:8443/


### Useful debug commands

```bash
# list status of docker compose images
docker-compose ps

# get the demosite logs of demosite
docker-compose logs demosite

# list networks
docker network list

#inspect a network
docker network inspect kroki-server_kroki_network
```


## Attribution

This is build on top of material provided by https://github.com/yuzutech/kroki