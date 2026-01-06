# Use an official lightweight Python image.
# https://hub.docker.com/_/python
FROM python:3.9-slim

# Set the working directory to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Train the ML model inside the container to ensure compatibility
# (Requires ml_data/ to be present in build context)
RUN python scripts/train_offloading_model.py

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Run flask when the container launches
CMD ["flask", "run", "--host=0.0.0.0"]
