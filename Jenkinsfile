// Jenkins equivalent of the GitHub Actions pipeline (declarative).
// Requires: NodeJS plugin (tool name 'node20'), Docker on the agent,
// and credentials 'dockerhub-creds' (user/pass) and 'deploy-ssh' (SSH key).
pipeline {
  agent any
  tools { nodejs 'node20' }
  environment {
    IMAGE = "youruser/student-task-manager"
    TAG   = "${env.BUILD_NUMBER}"
  }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Install')  { steps { sh 'npm ci' } }
    stage('Lint')     { steps { sh 'npm run lint' } }
    stage('Test')     { steps { sh 'npm test' } }
    stage('Build Image') {
      steps { sh 'docker build --build-arg APP_VERSION=1.0.$TAG --build-arg GIT_SHA=$GIT_COMMIT -t $IMAGE:$TAG -t $IMAGE:latest .' }
    }
    stage('Scan') {
      steps { sh 'docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image --severity CRITICAL --exit-code 1 --ignore-unfixed $IMAGE:$TAG' }
    }
    stage('Push') {
      when { branch 'main' }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-creds', usernameVariable: 'U', passwordVariable: 'P')]) {
          sh 'echo $P | docker login -u $U --password-stdin && docker push $IMAGE:$TAG && docker push $IMAGE:latest'
        }
      }
    }
    stage('Deploy') {
      when { branch 'main' }
      steps {
        sshagent(['deploy-ssh']) {
          sh '''ssh -o StrictHostKeyChecking=no $DEPLOY_USER@$DEPLOY_HOST \
                "docker pull $IMAGE:$TAG && docker rm -f web || true && docker run -d --name web -p 80:3000 -v taskdata:/app/data $IMAGE:$TAG"'''
        }
      }
    }
  }
  post { always { cleanWs() } }
}
