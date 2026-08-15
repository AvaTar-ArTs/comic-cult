# Local environment directory

Create a private local environment file:

  mkdir -p ~/.env.d
  cp .env.template ~/.env.d/comic-cult.env
  chmod 600 ~/.env.d/comic-cult.env

Load it only for the server process. Never place SMTP credentials, provider tokens, or recipient addresses in source code.
