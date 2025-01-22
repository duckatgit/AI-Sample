![Tapestry mono repo](./resources/tapestry-logo-design-01-1.png)

# Authorise the amazon cli so we can push images to ECR (need to do this locally and on the server).

1. Install AWS-CLI `sudo yum remove awscli && sudo yum install awscli` (on an ami), or follow other installation processes [here](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) (e.g. for windows).
2. Configure the AWS-CLI `aws configure` for `eu-north-1` with your access key credentials.

# How to create release images.

1. Authorise yourself with the AWS cli (as per above, should only need to be done once per machine).
2. Check the root package version number and make sure it is distinct.
3. Create a new RELEASE/vx.x.x versioned release branch. 
4. Build and deploy the images via `npm run build-and-release`

# How to deploy on the test server (tapestry.familygpt.app) 

Note amazon cli has been authorised already no need to do this step.

1. SSH to remote servers `ssh ec2-user@tapestry.familygpt.app`
2. `cd ~/tapestry-mono`
3. Ensure you have the latest .env file within your configs directory. You need an updated one within ./infrastructure/envs/test-familygpt-app/.env
4. Pull the latest images (for the teststack deployment) with this command `cd infrastructure/configs/teststack && docker compose pull`. If you inspect the docker compose file here `./infrastructure/configs/teststack/docker-compose.yml` one can see the tapestry-backend container has an image: `image: 851725561714.dkr.ecr.eu-north-1.amazonaws.com/tapestry-backend:latest` this is the default image it will pull and represents the latest release from Tapestry mono done via the `How to create release images` instructions. You can modify the docker compose to pull a specific version if you want to by changing the version after the colon aka replace `:latest` with `:v0.0.20` or whatever, or leave it as it is (recommended) deploying the `:latest` version and then run `cd infrastructure/configs/teststack && docker compose pull` again if you made a change.
5. Ensure you are within the projects root directory aka `tapestry-mono`. Deploy the latest container images: `docker stack deploy -c ./infrastructure/configs/teststack/docker-compose.yml teststack`

# How to reset the database.

1. Remove the test stack `docker stack rm teststack`
2. List all volumes: `docker volume ls`

You will see entries like this:
```[ec2-user@ip-172-31-8-253 tapestry-mono]$ docker volume ls
DRIVER    VOLUME NAME
local     caddy_data
local     teststack_mysql_data
local     teststack_weaviate_data_node0
```

3. Remove the mysql and weaviate volumes. `docker volume rm teststack_mysql_data && docker volume rm teststack_weaviate_data_node0` (leave the caddy volume alone! Dont remove it, it contains the TLS certificates!)
4. Re-launch the stack: `docker stack deploy -c ./infrastructure/configs/teststack/docker-compose.yml teststack`
5. Get a shell session within the `851725561714.dkr.ecr.eu-north-1.amazonaws.com/tapestry-backend:latest` container, first find the container id which matches this image and then get a session like this `docker exec -it <containerid> /bin/sh`
6. Inside the shell session within the backend container run the command to build the database `npm run danger:install:database`
7. Restart the backend container.

