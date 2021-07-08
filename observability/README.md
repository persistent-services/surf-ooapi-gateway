# Observability stack

This tree contains a development (local) setup for logging that mimics the
production setup.

It is intended to be run in combination with the
`docker-compose-test.yml` file in the parent directory.

## Starting the supporting services

You can start the supporting services by running

    cd observability # this directory
    docker-compose start

You can access the UI using username: admin and password: admin at
http://localhost:9000/

## Initializing Graylog

After starting the system for the first time you need to log in and
add the expected inputs:

 - go to http://localhost:9000/system/inputs
 - select input "GELF TCP"
 - click "Launch new input"
 - enter a title, i.e. "Gelf input"
 - click "Save"

## Reset full system

The observability setup is stateful and depends on different moving
parts that tend to get confused when they get killed / restarted. This
can manifest itself as events not showing up in graylog or messages
about elasticsearch indexes not being available.

The simplest brute-force way out is to shutdown the observability
stack and removing its state (removing the associated volumes):

    docker-compose down -v  # note the -v option

