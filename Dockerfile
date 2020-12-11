FROM openjdk:8-jdk

# Node.js

RUN curl -sL https://deb.nodesource.com/setup_14.x | bash - \
	&& apt-get install -y nodejs \
	&& apt update \
    && apt-get install -y xvfb \
	&& rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# Google Chrome
ENV APT_KEY_DONT_WARN_ON_DANGEROUS_USAGE=DontWarn
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
	&& echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
	&& apt-get update -qqy \
	&& apt-get -qqy install google-chrome-stable \
	&& rm /etc/apt/sources.list.d/google-chrome.list \
	&& rm -rf /var/lib/apt/lists/* /var/cache/apt/* \
	&& sed -i 's/"$HERE\/chrome"/"$HERE\/chrome" --no-sandbox/g' /opt/google/chrome/google-chrome
RUN npm config set strict-ssl=false \
    && npm config set registry=http://nexus.wdf.sap.corp:8081/nexus/content/groups/build.milestones.npm/ \
    && npm config set no-proxy=nexus.wdf.sap.corp

RUN npm install vyperForAll@latest -g -ignore-scripts
RUN vyper webdriver-update
RUN echo 'export DISPLAY=:99.0;Xvfb -ac $DISPLAY &' >>/root/.bashrc

# Create ccloud user
RUN groupadd ccloud -g 1000
RUN useradd ccloud -u 1000 -g 1000 -m -s /bin/bash
