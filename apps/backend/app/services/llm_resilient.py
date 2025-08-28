"""Enhanced LLM service with resilience, retries, and better error handling."""
import os
import asyncio
import logging
from typing import Dict, Any, Optional, List, Union
from dataclasses import dataclass
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, BaseMessage

logger = logging.getLogger(__name__)


@dataclass
class LLMConfig:
    """Configuration for LLM instances."""
    model: str
    temperature: float = 0.2
    max_tokens: Optional[int] = None
    timeout: int = 60
    max_retries: int = 3
    retry_delay: float = 1.0


@dataclass
class LLMResponse:
    """Standardized LLM response format."""
    content: str
    model: str
    tokens_used: Optional[int] = None
    success: bool = True
    error: Optional[str] = None


class LLMError(Exception):
    """Custom exception for LLM-related errors."""
    pass


class ResilientLLMService:
    """Enhanced LLM service with reliability features."""
    
    def __init__(self):
        self.api_key = os.getenv("OPENAI_API_KEY")
        self._clients = {}
        
        # Default configurations
        self.configs = {
            "default": LLMConfig(
                model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
                temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.2"))
            ),
            "pain_points": LLMConfig(
                model=os.getenv("PAIN_POINT_MODEL", "gpt-4o-mini"),
                temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.2"))
            ),
            "vision": LLMConfig(
                model=os.getenv("VISION_MODEL", "gpt-4o"),
                temperature=float(os.getenv("OPENAI_TEMPERATURE", "0.2"))
            ),
        }
        
        # Initialize clients
        self._initialize_clients()
    
    def _initialize_clients(self) -> None:
        """Initialize LLM clients based on configurations."""
        if not self.api_key:
            logger.warning("OpenAI API key not found - LLM services will be disabled")
            return
            
        for name, config in self.configs.items():
            try:
                client = ChatOpenAI(
                    model=config.model,
                    temperature=config.temperature,
                    max_tokens=config.max_tokens,
                    request_timeout=config.timeout,
                    api_key=self.api_key
                )
                self._clients[name] = client
                logger.info(f"Initialized {name} LLM client with model {config.model}")
            except Exception as e:
                logger.error(f"Failed to initialize {name} LLM client: {e}")
    
    def is_available(self, client_name: str = "default") -> bool:
        """Check if a specific LLM client is available."""
        return client_name in self._clients
    
    async def _invoke_with_retry(
        self, 
        client: ChatOpenAI, 
        messages: List[BaseMessage], 
        config: LLMConfig
    ) -> str:
        """Invoke LLM with retry logic and timeout handling."""
        last_error = None
        
        for attempt in range(config.max_retries):
            try:
                # Use asyncio timeout for the entire operation
                response = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None, client.invoke, messages
                    ),
                    timeout=config.timeout
                )
                return response.content
                
            except asyncio.TimeoutError:
                last_error = "LLM request timed out"
                logger.warning(f"LLM timeout on attempt {attempt + 1}/{config.max_retries}")
                
            except Exception as e:
                last_error = str(e)
                logger.warning(f"LLM error on attempt {attempt + 1}/{config.max_retries}: {e}")
            
            # Wait before retry (except on last attempt)
            if attempt < config.max_retries - 1:
                await asyncio.sleep(config.retry_delay * (attempt + 1))
        
        raise LLMError(f"LLM failed after {config.max_retries} attempts. Last error: {last_error}")
    
    async def invoke(
        self, 
        messages: Union[str, List[Dict[str, str]], List[BaseMessage]], 
        client_name: str = "default"
    ) -> LLMResponse:
        """
        Invoke an LLM with the given messages.
        
        Args:
            messages: Can be a string, list of message dicts, or list of BaseMessage objects
            client_name: Which LLM client to use
            
        Returns:
            LLMResponse with content and metadata
        """
        if not self.is_available(client_name):
            return LLMResponse(
                content="",
                model="unavailable",
                success=False,
                error=f"LLM client '{client_name}' not available"
            )
        
        client = self._clients[client_name]
        config = self.configs[client_name]
        
        # Convert messages to LangChain format
        langchain_messages = self._convert_messages(messages)
        
        try:
            content = await self._invoke_with_retry(client, langchain_messages, config)
            
            return LLMResponse(
                content=content,
                model=config.model,
                success=True
            )
            
        except Exception as e:
            logger.error(f"LLM invocation failed: {e}")
            return LLMResponse(
                content="",
                model=config.model,
                success=False,
                error=str(e)
            )
    
    def _convert_messages(self, messages: Union[str, List[Dict[str, str]], List[BaseMessage]]) -> List[BaseMessage]:
        """Convert various message formats to LangChain BaseMessage objects."""
        if isinstance(messages, str):
            return [HumanMessage(content=messages)]
            
        if isinstance(messages, list):
            if not messages:
                raise ValueError("Messages list cannot be empty")
                
            # If already BaseMessage objects, return as-is
            if isinstance(messages[0], BaseMessage):
                return messages
            
            # Convert from dict format
            langchain_messages = []
            for msg in messages:
                if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
                    raise ValueError("Message dicts must have 'role' and 'content' keys")
                
                role = msg["role"]
                content = msg["content"]
                
                if role == "system":
                    langchain_messages.append(SystemMessage(content=content))
                elif role in ["user", "human"]:
                    langchain_messages.append(HumanMessage(content=content))
                else:
                    # Default to HumanMessage for unknown roles
                    langchain_messages.append(HumanMessage(content=content))
            
            return langchain_messages
        
        raise ValueError(f"Unsupported message format: {type(messages)}")
    
    async def chat_with_vision(self, messages: List[Dict[str, str]], image_base64: str) -> LLMResponse:
        """
        Chat with vision-capable LLM using image analysis.
        """
        if not self.is_available("vision"):
            return LLMResponse(
                content="",
                model="unavailable",
                success=False,
                error="Vision LLM not available"
            )
        
        try:
            # Convert messages to LangChain format with image
            langchain_messages = []
            
            for msg in messages:
                if msg["role"] == "system":
                    continue  # Will be incorporated into user message
                elif msg["role"] == "user":
                    # Find system message content
                    system_content = ""
                    for m in messages:
                        if m["role"] == "system":
                            system_content = f"System: {m['content']}\n\n"
                            break
                    
                    # Create message with both text and image
                    content = [
                        {"type": "text", "text": f"{system_content}User: {msg['content']}"},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/png;base64,{image_base64}"
                            }
                        }
                    ]
                    langchain_messages.append(HumanMessage(content=content))
            
            client = self._clients["vision"]
            config = self.configs["vision"]
            
            content = await self._invoke_with_retry(client, langchain_messages, config)
            
            return LLMResponse(
                content=content,
                model=config.model,
                success=True
            )
            
        except Exception as e:
            logger.error(f"Vision analysis failed: {e}")
            return LLMResponse(
                content="",
                model=self.configs["vision"].model,
                success=False,
                error=f"Vision analysis failed: {str(e)}"
            )
    
    async def health_check(self, client_name: str = "default") -> Dict[str, Any]:
        """Perform a health check on the specified LLM client."""
        if not self.is_available(client_name):
            return {
                "healthy": False,
                "error": f"Client '{client_name}' not available",
                "model": "unknown"
            }
        
        try:
            response = await self.invoke("Say 'OK'", client_name)
            
            return {
                "healthy": response.success,
                "model": response.model,
                "response_preview": response.content[:50] if response.content else None,
                "error": response.error
            }
            
        except Exception as e:
            return {
                "healthy": False,
                "error": str(e),
                "model": self.configs[client_name].model
            }


# Create global service instance
llm_service = ResilientLLMService()

# Legacy compatibility - maintain existing interface
llm = llm_service._clients.get("default")
pain_point_llm = llm_service._clients.get("pain_points")
vision_llm = llm_service._clients.get("vision")

# Legacy temperature constant
EFFECTIVE_TEMPERATURE = llm_service.configs["default"].temperature


def get_pain_point_llm() -> Optional[ChatOpenAI]:
    """Get the specialized LLM for pain point analysis."""
    return pain_point_llm


# Legacy async functions with improved implementation
async def evaluate_use_cases(description: str) -> Dict[str, Any]:
    """Legacy function using new service."""
    prompt = f"""You are an AI use case evaluator. Provide a concise 1-2 paragraph assessment and a 1-100 score for feasibility, impact, and strategic alignment.

Use Case:
{description}

Return strict JSON with keys: feasibility, impact, alignment, rationale."""
    
    response = await llm_service.invoke(prompt)
    
    if not response.success:
        # Fallback logic
        base = min(90, 40 + len(description) % 50)
        scores = {"feasibility": base - 10, "impact": base, "alignment": base - 5}
        return {"rationale": f"LLM unavailable ({response.error}); returning placeholder.", **scores}
    
    return {"rationale": response.content}


async def ethics_review(description: str) -> Dict[str, Any]:
    """Legacy function using new service."""
    prompt = f"""You are an ethics reviewer. Provide concise assessments (2-3 sentences each) with 1-10 ratings for: deontological, utilitarian, social_contract, virtue. Then give an overall recommendation.

Use Case:
{description}

Return strict JSON with keys: deontological, utilitarian, social_contract, virtue, recommendation."""
    
    response = await llm_service.invoke(prompt)
    
    if not response.success:
        return {"summary": f"LLM unavailable ({response.error}); placeholder ethics review."}
    
    return {"summary": response.content}


# Expose the service for direct use in new code
__all__ = ["llm_service", "ResilientLLMService", "LLMResponse", "LLMError", "llm", "pain_point_llm", "vision_llm"]
