FROM r-base:4.4.2

ENV R_VERSION=4.4.2
ENV BIOCONDUCTOR_VERSION=3.20
ENV RENV_VERSION=1.0.11
ENV RENV_CONFIG_PPM_ENABLED=false
ENV RENV_CONFIG_REPOS_OVERRIDE=https://cloud.r-project.org

# Install system dependencies required for R packages
RUN apt-get update && apt-get install -y \
    libcurl4-openssl-dev \
    libssl-dev \
    libxml2-dev \
    libcairo2-dev \
    libgit2-dev \
    default-libmysqlclient-dev \
    libpq-dev \
    libsasl2-dev \
    libsqlite3-dev \
    libssh2-1-dev \
    unixodbc-dev \
    libharfbuzz-dev \
    libfribidi-dev \
    libfreetype6-dev \
    libpng-dev \
    libtiff5-dev \
    libjpeg-dev \
    libgsl-dev \
    libbz2-dev \
    liblzma-dev \
    libpcre2-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy only files that are needed
COPY *.R .

# Default command runs Rscript
ENTRYPOINT ["Rscript"]