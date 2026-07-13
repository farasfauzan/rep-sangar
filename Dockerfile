# ─── Stage 1: Build frontend assets ───────────────────────
FROM node:20-alpine AS frontend

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─── Stage 2: PHP + Apache application ────────────────────
FROM php:8.3-apache

# Install PHP extensions required by Laravel
RUN apt-get update && apt-get install -y --no-install-recommends \
        git unzip libzip-dev libpng-dev libonig-dev libxml2-dev \
    && docker-php-ext-install pdo_mysql mbstring zip bcmath gd opcache \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Enable Apache mod_rewrite
RUN a2enmod rewrite

# Set Apache document root to Laravel's public directory
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -i 's|/var/www/html|${APACHE_DOCUMENT_ROOT}|g' \
        /etc/apache2/sites-available/000-default.conf \
    && sed -i '/<Directory \/var\/www\/>/,/<\/Directory>/ AllowOverride None/ s/None/All/' \
        /etc/apache2/apache2.conf

WORKDIR /var/www/html

# Copy composer files and install dependencies (cached layer)
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader

# Copy application source
COPY . .

# Copy built frontend assets from stage 1
COPY --from=frontend /app/public/build ./public/build

# Set permissions for storage and cache
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache

EXPOSE 80
