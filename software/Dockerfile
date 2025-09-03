FROM r-base:4.4.2

ENV R_VERSION=4.4.2
ENV RENV_CONFIG_PPM_ENABLED=false
ENV RENV_CONFIG_REPOS_OVERRIDE=https://cloud.r-project.org

# Install system dependencies required for R packages
RUN apt-get update && apt-get install -y \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy files that are needed
COPY *.R .

# Default command
ENTRYPOINT ["Rscript"]