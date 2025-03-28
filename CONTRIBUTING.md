# Contributing to Kroki Server

Thank you for your interest in contributing to Kroki Server! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and considerate of others when contributing to this project. Everyone should feel welcome to contribute, regardless of their background or experience level.

## How to Contribute

### Reporting Bugs

If you find a bug, please create an issue on GitHub with the following information:
- A clear, descriptive title
- Steps to reproduce the bug
- Expected behavior
- Actual behavior
- Any relevant logs or screenshots
- Your environment (OS, Docker version, browser, etc.)

### Suggesting Enhancements

If you have an idea for an enhancement:
- Create an issue with a clear, descriptive title
- Describe the current behavior and explain why it's insufficient
- Describe the enhancement and how it would improve the project
- Provide examples of how the enhancement would work

### Pull Requests

1. Fork the repository
2. Create a new branch: `git checkout -b feature/your-feature-name`
3. Make your changes
4. Test your changes
5. Commit your changes: `git commit -m 'Add some feature'`
6. Push to the branch: `git push origin feature/your-feature-name`
7. Submit a pull request

### Pull Request Guidelines

- Include a clear, descriptive title
- Reference any related issues
- Update documentation if necessary
- Add tests for new features
- Ensure all tests pass
- Follow the existing code style
- Keep pull requests focused on a single concern

## Development Setup

### Prerequisites

- Docker
- Docker Compose
- Bash shell

### Getting Started

1. Clone the repository
2. Run `./setup-kroki-server.sh start`
3. Access the server at https://localhost:8443/

## Testing

- Run the setup script with the `test` option
- Verify that all diagram types render correctly
- Test HTTPS functionality

## Documentation

If you add a new feature, please update the documentation:
- Update the README.md file
- Add examples if applicable
- Document any new configuration options

## License

By contributing to this project, you agree that your contributions will be licensed under the project's [MIT License](LICENSE.md).