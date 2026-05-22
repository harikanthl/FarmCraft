FROM rocker/r-base:4.4.0

RUN R -e "install.packages(c('plumber','jsonlite'), repos='https://cloud.r-project.org')"

WORKDIR /app
COPY plumber.R entrypoint.R ./

ENV PORT=8000
EXPOSE 8000

CMD ["Rscript", "entrypoint.R"]
